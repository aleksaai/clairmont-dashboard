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
        metadata: session.metadata 
      });

      // Only process if payment was successful
      if (session.payment_status === "paid") {
        const folderId = session.metadata?.folder_id;
        const customerName = session.metadata?.customer_name;
        const prognoseAmount = session.metadata?.prognose_amount;
        const feeAmount = session.metadata?.fee_amount;

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
          feeAmount 
        });

        // Create Supabase client with service role for database updates
        const supabaseClient = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
          { auth: { persistSession: false } }
        );

        // Update folder status to "bezahlt"
        const { error: updateError } = await supabaseClient
          .from("folders")
          .update({
            payment_status: "paid",
            status: "bezahlt",
          })
          .eq("id", folderId);

        if (updateError) {
          logStep("Error updating folder", { error: updateError.message });
          throw new Error(`Failed to update folder: ${updateError.message}`);
        }

        logStep("Folder updated successfully", { folderId, newStatus: "bezahlt" });

        // Send email notification to Clairmont team
        if (resendApiKey) {
          try {
            const resend = new Resend(resendApiKey);
            
            const formattedFee = feeAmount ? parseFloat(feeAmount).toFixed(2).replace('.', ',') : 'N/A';
            const formattedPrognose = prognoseAmount ? parseFloat(prognoseAmount).toFixed(2).replace('.', ',') : 'N/A';
            
            const teamEmail = "aleksa@spalevic-consulting.de";
            
            const emailHtml = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #16a34a; margin-bottom: 24px;">✓ Zahlung eingegangen!</h2>
                
                <p style="font-size: 16px; color: #333; line-height: 1.6;">
                  Gute Nachrichten! Der Kunde <strong>${customerName || 'Unbekannt'}</strong> hat soeben die Zahlung abgeschlossen.
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
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280;">Gezahlte Gebühr (30%):</td>
                      <td style="padding: 8px 0; color: #16a34a; font-weight: 600;">${formattedFee} €</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280;">Status:</td>
                      <td style="padding: 8px 0; color: #16a34a; font-weight: 600;">Bezahlt ✓</td>
                    </tr>
                  </table>
                </div>
                
                <p style="font-size: 14px; color: #6b7280; margin-top: 24px;">
                  Der Fall wurde automatisch auf "Bezahlt" gesetzt und kann nun weiter bearbeitet werden.
                </p>
                
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
                
                <p style="font-size: 12px; color: #9ca3af;">
                  Diese E-Mail wurde automatisch von Clairmont Advisory gesendet.
                </p>
              </div>
            `;

            const { error: emailError } = await resend.emails.send({
              from: "Clairmont Advisory <noreply@tax.clairmont-advisory.com>",
              to: [teamEmail],
              subject: `✓ Zahlung eingegangen: ${customerName || 'Kunde'}`,
              html: emailHtml,
            });

            if (emailError) {
              logStep("Error sending notification email", { error: emailError });
            } else {
              logStep("Notification email sent successfully", { to: teamEmail });
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
