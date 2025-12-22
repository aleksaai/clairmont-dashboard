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
  console.log(`[PAYMENT-REMINDERS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Payment reminders job started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not set");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const resend = new Resend(resendApiKey);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get all active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      status: "active",
      limit: 100,
      expand: ["data.latest_invoice"],
    });

    logStep("Found active subscriptions", { count: subscriptions.data.length });

    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    
    let remindersSent = 0;

    for (const subscription of subscriptions.data) {
      try {
        const folderId = subscription.metadata?.folder_id;
        const customerName = subscription.metadata?.customer_name;

        if (!folderId) {
          continue;
        }

        // Get next billing date
        const nextBillingDate = new Date(subscription.current_period_end * 1000);
        const daysUntilBilling = Math.ceil((nextBillingDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        logStep("Checking subscription", { 
          subscriptionId: subscription.id, 
          folderId, 
          nextBillingDate: nextBillingDate.toISOString(),
          daysUntilBilling 
        });

        // Send reminder 3 days before next payment
        if (daysUntilBilling === 3) {
          // Get customer email from folder
          const { data: folderData } = await supabaseClient
            .from("folders")
            .select("customer_email, installment_fee")
            .eq("id", folderId)
            .maybeSingle();

          const customerEmail = folderData?.customer_email;
          const installmentFee = folderData?.installment_fee;

          if (!customerEmail) {
            logStep("No customer email found for folder", { folderId });
            continue;
          }

          const formattedAmount = installmentFee 
            ? parseFloat(String(installmentFee)).toFixed(2).replace('.', ',') 
            : 'N/A';
          
          const formattedDate = nextBillingDate.toLocaleDateString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          });

          const reminderEmailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #2563eb; margin-bottom: 24px;">📅 Erinnerung: Anstehende Zahlung</h2>
              
              <p style="font-size: 16px; color: #333; line-height: 1.6;">
                Sehr geehrte/r ${customerName || 'Kunde/Kundin'},
              </p>
              
              <p style="font-size: 16px; color: #333; line-height: 1.6;">
                wir möchten Sie daran erinnern, dass Ihre nächste Rate in Kürze fällig wird.
              </p>
              
              <div style="background-color: #eff6ff; border: 1px solid #2563eb; border-radius: 8px; padding: 20px; margin: 24px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #1e40af;">Fälligkeitsdatum:</td>
                    <td style="padding: 8px 0; color: #1e3a8a; font-weight: 600;">${formattedDate}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #1e40af;">Betrag:</td>
                    <td style="padding: 8px 0; color: #1e3a8a; font-weight: 600;">${formattedAmount} €</td>
                  </tr>
                </table>
              </div>
              
              <p style="font-size: 16px; color: #333; line-height: 1.6;">
                Bitte stellen Sie sicher, dass Ihre Zahlungsmethode aktuell ist und ausreichend Deckung vorhanden ist.
                Die Abbuchung erfolgt automatisch am Fälligkeitsdatum.
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
            subject: `📅 Erinnerung: Zahlung am ${formattedDate} - Clairmont Advisory`,
            html: reminderEmailHtml,
          });

          if (emailError) {
            logStep("Error sending payment reminder", { error: emailError, customerEmail });
          } else {
            logStep("Payment reminder sent successfully", { to: customerEmail, folderId });
            remindersSent++;
          }
        }
      } catch (subError) {
        const errorMessage = subError instanceof Error ? subError.message : String(subError);
        logStep("Error processing subscription", { subscriptionId: subscription.id, error: errorMessage });
      }
    }

    logStep("Payment reminders job completed", { remindersSent });

    return new Response(JSON.stringify({ 
      success: true, 
      remindersSent,
      subscriptionsChecked: subscriptions.data.length 
    }), {
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
