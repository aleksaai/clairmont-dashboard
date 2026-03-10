import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET is not set");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Get the signature from headers
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      throw new Error("No stripe-signature header found");
    }

    // Get the raw body
    const body = await req.text();
    logStep("Body received", { length: body.length });

    // Verify the webhook signature
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logStep("Signature verification failed", { error: errorMessage });
      return new Response(JSON.stringify({ error: `Webhook signature verification failed: ${errorMessage}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    logStep("Event verified", { type: event.type, id: event.id });

    // Handle checkout.session.completed event
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      logStep("Checkout session completed", { 
        sessionId: session.id, 
        paymentStatus: session.payment_status,
        mode: session.mode,
        metadata: session.metadata 
      });

      // Create Supabase client with service role for database updates
      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { persistSession: false } }
      );

      // Handle subscription mode - set cancel_at on the subscription
      if (session.mode === "subscription" && session.subscription) {
        const installmentCount = parseInt(session.metadata?.installment_count || "1", 10);
        
        if (installmentCount > 1) {
          // Calculate cancel_at: subscription ends after X months (installments)
          const cancelAtDate = new Date();
          cancelAtDate.setMonth(cancelAtDate.getMonth() + installmentCount);
          const cancelAtTimestamp = Math.floor(cancelAtDate.getTime() / 1000);
          
          logStep("Setting subscription cancel_at", { 
            subscriptionId: session.subscription, 
            installmentCount, 
            cancelAtDate: cancelAtDate.toISOString() 
          });

          try {
            await stripe.subscriptions.update(session.subscription as string, {
              cancel_at: cancelAtTimestamp,
            });
            logStep("Subscription cancel_at set successfully");
          } catch (subError) {
            const subErrorMessage = subError instanceof Error ? subError.message : String(subError);
            logStep("Error setting subscription cancel_at", { error: subErrorMessage });
          }
        }
      }

      // Only process payment updates if payment was successful
      if (session.payment_status === "paid") {
        const folderId = session.metadata?.folder_id;
        const customerName = session.metadata?.customer_name;
        const prognoseAmount = session.metadata?.prognose_amount;
        const feeAmount = session.metadata?.fee_amount || session.metadata?.total_fee;
        const installmentCount = parseInt(session.metadata?.installment_count || "1", 10);

        if (!folderId) {
          logStep("No folder_id in metadata, skipping");
          return new Response(JSON.stringify({ received: true, skipped: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }

        logStep("Processing payment for folder", { 
          folderId, 
          customerName, 
          prognoseAmount, 
          feeAmount,
          installmentCount
        });

        // Determine status: "anzahlung_erhalten" for installments, "bezahlt" for one-time
        const newStatus = installmentCount > 1 ? "anzahlung_erhalten" : "bezahlt";

        // Calculate next payment date for installments
        let nextPaymentDate: string | null = null;
        if (installmentCount > 1) {
          const nextDate = new Date();
          nextDate.setMonth(nextDate.getMonth() + 1);
          nextPaymentDate = nextDate.toISOString();
        }

        // Update folder status with installment tracking
        const { error: updateError } = await supabaseClient
          .from("folders")
          .update({
            payment_status: "paid",
            status: newStatus,
            installments_paid: 1,
            next_payment_date: nextPaymentDate,
          })
          .eq("id", folderId);

        if (updateError) {
          logStep("Error updating folder", { error: updateError.message });
          throw new Error(`Failed to update folder: ${updateError.message}`);
        }

        logStep("Folder updated successfully", { folderId, newStatus, installmentsPaid: 1, nextPaymentDate });

        // Get customer email from folder
        const { data: folderData } = await supabaseClient
          .from("folders")
          .select("customer_email")
          .eq("id", folderId)
          .maybeSingle();

        const customerEmail = folderData?.customer_email;

        // Send email notifications
        if (resendApiKey) {
          try {
            const resend = new Resend(resendApiKey);
            
            const formattedFee = feeAmount ? parseFloat(feeAmount).toFixed(2).replace('.', ',') : 'N/A';
            const formattedPrognose = prognoseAmount ? parseFloat(prognoseAmount).toFixed(2).replace('.', ',') : 'N/A';
            
            // Calculate installment amount if applicable
            const isInstallment = installmentCount > 1;
            const installmentAmount = isInstallment && feeAmount 
              ? (parseFloat(feeAmount) / installmentCount).toFixed(2).replace('.', ',') 
              : null;
            
            const teamEmail = "service@clairmont-advisory.com";
            
            // Email to team
            const teamEmailHtml = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #16a34a; margin-bottom: 24px;">✓ Zahlung eingegangen!</h2>
                
                <p style="font-size: 16px; color: #333; line-height: 1.6;">
                  Gute Nachrichten! Der Kunde <strong>${customerName || 'Unbekannt'}</strong> hat soeben ${isInstallment ? 'die erste Rate bezahlt' : 'die Zahlung abgeschlossen'}.
                </p>
                
                <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin: 24px 0;">
                  <h3 style="margin: 0 0 16px 0; color: #374151;">Zahlungsdetails</h3>
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280;">Kunde:</td>
                      <td style="padding: 8px 0; color: #111827; font-weight: 600;">${customerName || 'Unbekannt'}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280;">Prognose:</td>
                      <td style="padding: 8px 0; color: #111827; font-weight: 600;">${formattedPrognose} €</td>
                    </tr>
                    ${isInstallment ? `
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280;">Zahlungsart:</td>
                      <td style="padding: 8px 0; color: #111827; font-weight: 600;">Ratenzahlung (${installmentCount} Monate)</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280;">Gesamtgebühr (30%):</td>
                      <td style="padding: 8px 0; color: #111827; font-weight: 600;">${formattedFee} €</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280;">Gezahlte 1. Rate:</td>
                      <td style="padding: 8px 0; color: #16a34a; font-weight: 600;">${installmentAmount} € ✓</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280;">Ausstehend:</td>
                      <td style="padding: 8px 0; color: #f59e0b; font-weight: 600;">${installmentCount - 1} weitere Raten</td>
                    </tr>
                    ` : `
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280;">Gezahlte Gebühr (30%):</td>
                      <td style="padding: 8px 0; color: #16a34a; font-weight: 600;">${formattedFee} €</td>
                    </tr>
                    `}
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280;">Status:</td>
                      <td style="padding: 8px 0; color: #16a34a; font-weight: 600;">${isInstallment ? 'Anzahlung erhalten' : 'Bezahlt'} ✓</td>
                    </tr>
                  </table>
                </div>
                
                <p style="font-size: 14px; color: #6b7280; margin-top: 24px;">
                  Der Fall wurde automatisch auf "${isInstallment ? 'Anzahlung erhalten' : 'Bezahlt'}" gesetzt und kann nun weiter bearbeitet werden.
                </p>
                
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
                
                <p style="font-size: 12px; color: #9ca3af;">
                  Diese E-Mail wurde automatisch von Clairmont Advisory gesendet.
                </p>
              </div>
            `;

            const { error: teamEmailError } = await resend.emails.send({
              from: "Clairmont Advisory <noreply@tax.clairmont-advisory.com>",
              to: [teamEmail],
              subject: `✓ Zahlung eingegangen: ${customerName || 'Kunde'}`,
              html: teamEmailHtml,
            });

            if (teamEmailError) {
              logStep("Error sending team notification email", { error: teamEmailError });
            } else {
              logStep("Team notification email sent successfully", { to: teamEmail });
            }

            // Email to customer (confirmation)
            if (customerEmail) {
              const isInstallment = installmentCount > 1;
              const customerEmailHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <h2 style="color: #16a34a; margin-bottom: 24px;">✓ Zahlungsbestätigung</h2>
                  
                  <p style="font-size: 16px; color: #333; line-height: 1.6;">
                    Sehr geehrte/r ${customerName || 'Kunde/Kundin'},
                  </p>
                  
                  <p style="font-size: 16px; color: #333; line-height: 1.6;">
                    vielen Dank für Ihre Zahlung! Wir haben ${isInstallment ? 'Ihre erste Rate' : 'Ihre Zahlung'} in Höhe von <strong>${formattedFee} €</strong> erfolgreich erhalten.
                  </p>

                  ${isInstallment ? `
                  <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 24px 0;">
                    <p style="margin: 0; color: #92400e; font-size: 14px;">
                      <strong>Hinweis zur Ratenzahlung:</strong> Sie haben eine Ratenzahlung über ${installmentCount} Monate gewählt. 
                      Die weiteren Raten werden automatisch monatlich von Ihrem Konto abgebucht.
                    </p>
                  </div>
                  ` : ''}
                  
                  <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin: 24px 0;">
                    <h3 style="margin: 0 0 16px 0; color: #374151;">Wie geht es weiter?</h3>
                    <p style="margin: 0; color: #4b5563; line-height: 1.6;">
                      Wir werden nun Ihre Unterlagen prüfen und Ihre Steuererklärung beim Finanzamt einreichen. 
                      Sie erhalten von uns eine Benachrichtigung, sobald es Neuigkeiten gibt.
                    </p>
                  </div>
                  
                  <p style="font-size: 14px; color: #6b7280; margin-top: 24px;">
                    Bei Fragen stehen wir Ihnen jederzeit zur Verfügung.
                  </p>
                  
                  <p style="font-size: 16px; color: #333; margin-top: 24px;">
                    Mit freundlichen Grüßen,<br>
                    <strong>Ihr Clairmont Advisory Team</strong>
                  </p>
                  
                  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
                  
                  <p style="font-size: 12px; color: #9ca3af;">
                    Diese E-Mail wurde automatisch von Clairmont Advisory gesendet.
                  </p>
                </div>
              `;

              const { error: customerEmailError } = await resend.emails.send({
                from: "Clairmont Advisory <noreply@tax.clairmont-advisory.com>",
                to: [customerEmail],
                subject: `Zahlungsbestätigung - Clairmont Advisory`,
                html: customerEmailHtml,
              });

              if (customerEmailError) {
                logStep("Error sending customer confirmation email", { error: customerEmailError });
              } else {
                logStep("Customer confirmation email sent successfully", { to: customerEmail });
              }
            } else {
              logStep("No customer email found, skipping customer confirmation");
            }
          } catch (emailErr) {
            const errorMessage = emailErr instanceof Error ? emailErr.message : String(emailErr);
            logStep("Error in email notification process", { error: errorMessage });
            // Don't throw - email is not critical
          }
        } else {
          logStep("RESEND_API_KEY not set, skipping email notification");
        }
      } else {
        logStep("Payment not yet paid", { paymentStatus: session.payment_status });
      }
    }

    // Handle invoice.paid - recurring payment successful (for installments after the first)
    if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;
      
      // Only process subscription invoices that are not the first one
      if (invoice.billing_reason === "subscription_cycle" && invoice.subscription) {
        logStep("Subscription invoice paid", { 
          invoiceId: invoice.id, 
          subscriptionId: invoice.subscription,
          billingReason: invoice.billing_reason,
          metadata: invoice.subscription_details?.metadata 
        });

        const folderId = invoice.subscription_details?.metadata?.folder_id;
        const installmentCount = parseInt(invoice.subscription_details?.metadata?.installment_count || "1", 10);
        
        if (folderId && installmentCount > 1) {
          const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
            { auth: { persistSession: false } }
          );

          // Get current installments_paid
          const { data: folderData } = await supabaseClient
            .from("folders")
            .select("installments_paid")
            .eq("id", folderId)
            .maybeSingle();

          const currentPaid = folderData?.installments_paid || 1;
          const newPaid = currentPaid + 1;

          // Calculate next payment date
          const nextDate = new Date();
          nextDate.setMonth(nextDate.getMonth() + 1);

          // Check if this is the last installment
          const isLastInstallment = newPaid >= installmentCount;

          const { error: updateError } = await supabaseClient
            .from("folders")
            .update({
              installments_paid: newPaid,
              next_payment_date: isLastInstallment ? null : nextDate.toISOString(),
              status: isLastInstallment ? "bezahlt" : "anzahlung_erhalten",
            })
            .eq("id", folderId);

          if (updateError) {
            logStep("Error updating installment count", { error: updateError.message });
          } else {
            logStep("Installment count updated", { 
              folderId, 
              installmentsPaid: newPaid, 
              totalInstallments: installmentCount,
              isLastInstallment 
            });
          }
        }
      }
    }

    // Handle invoice.payment_failed - payment failed for subscription
    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      logStep("Invoice payment failed", { 
        invoiceId: invoice.id, 
        subscriptionId: invoice.subscription,
        metadata: invoice.subscription_details?.metadata 
      });

      const folderId = invoice.subscription_details?.metadata?.folder_id;
      const customerName = invoice.subscription_details?.metadata?.customer_name;
      
      if (folderId) {
        const supabaseClient = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
          { auth: { persistSession: false } }
        );

        // Get customer email from folder
        const { data: folderData } = await supabaseClient
          .from("folders")
          .select("customer_email")
          .eq("id", folderId)
          .maybeSingle();

        const { error: updateError } = await supabaseClient
          .from("folders")
          .update({ status: "rueckstand" })
          .eq("id", folderId);

        if (updateError) {
          logStep("Error updating folder to rueckstand", { error: updateError.message });
        } else {
          logStep("Folder updated to rueckstand", { folderId });
        }

        // Send payment failed reminder to customer
        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        const customerEmail = folderData?.customer_email;
        
        if (resendApiKey && customerEmail) {
          try {
            const resend = new Resend(resendApiKey);
            
            const amountDue = invoice.amount_due ? (invoice.amount_due / 100).toFixed(2).replace('.', ',') : 'N/A';
            
            const reminderEmailHtml = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #dc2626; margin-bottom: 24px;">⚠️ Zahlungserinnerung</h2>
                
                <p style="font-size: 16px; color: #333; line-height: 1.6;">
                  Sehr geehrte/r ${customerName || 'Kunde/Kundin'},
                </p>
                
                <p style="font-size: 16px; color: #333; line-height: 1.6;">
                  leider konnte Ihre letzte Rate in Höhe von <strong>${amountDue} €</strong> nicht abgebucht werden.
                </p>
                
                <div style="background-color: #fef2f2; border: 1px solid #dc2626; border-radius: 8px; padding: 20px; margin: 24px 0;">
                  <h3 style="margin: 0 0 12px 0; color: #991b1b;">Was Sie tun können:</h3>
                  <ul style="margin: 0; padding-left: 20px; color: #7f1d1d;">
                    <li style="margin-bottom: 8px;">Überprüfen Sie, ob Ihre Zahlungsmethode noch gültig ist</li>
                    <li style="margin-bottom: 8px;">Stellen Sie sicher, dass ausreichend Deckung vorhanden ist</li>
                    <li>Kontaktieren Sie uns bei Fragen</li>
                  </ul>
                </div>
                
                <p style="font-size: 16px; color: #333; line-height: 1.6;">
                  Stripe wird automatisch versuchen, die Zahlung erneut abzubuchen. 
                  Bitte stellen Sie sicher, dass Ihre Zahlungsmethode aktuell ist.
                </p>
                
                <p style="font-size: 16px; color: #333; margin-top: 24px;">
                  Mit freundlichen Grüßen,<br>
                  <strong>Ihr Clairmont Advisory Team</strong>
                </p>
                
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
                
                <p style="font-size: 12px; color: #9ca3af;">
                  Diese E-Mail wurde automatisch von Clairmont Advisory gesendet.
                </p>
              </div>
            `;

            const { error: emailError } = await resend.emails.send({
              from: "Clairmont Advisory <noreply@tax.clairmont-advisory.com>",
              to: [customerEmail],
              subject: `⚠️ Zahlungserinnerung - Clairmont Advisory`,
              html: reminderEmailHtml,
            });

            if (emailError) {
              logStep("Error sending payment failed reminder", { error: emailError });
            } else {
              logStep("Payment failed reminder sent to customer", { to: customerEmail });
            }
          } catch (emailErr) {
            const errorMessage = emailErr instanceof Error ? emailErr.message : String(emailErr);
            logStep("Error sending payment failed email", { error: errorMessage });
          }
        }
      }
    }

    // Handle customer.subscription.deleted - subscription completed or cancelled
    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      logStep("Subscription deleted", { 
        subscriptionId: subscription.id, 
        status: subscription.status,
        cancelReason: subscription.cancellation_details?.reason,
        metadata: subscription.metadata 
      });

      const folderId = subscription.metadata?.folder_id;
      
      // Only update to "bezahlt" if subscription ended normally (not due to payment failure)
      if (folderId && subscription.cancellation_details?.reason !== "payment_failed") {
        const supabaseClient = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
          { auth: { persistSession: false } }
        );

        const { error: updateError } = await supabaseClient
          .from("folders")
          .update({ status: "bezahlt" })
          .eq("id", folderId);

        if (updateError) {
          logStep("Error updating folder to bezahlt", { error: updateError.message });
        } else {
          logStep("Folder updated to bezahlt after subscription completed", { folderId });
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
