import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PaymentLinkRequest {
  folderId: string;
  customerName: string;
  customerEmail: string;
  prognoseAmount: number;
}

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-PAYMENT-LINK] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    logStep("Stripe key verified");

    // Create Supabase client with service role for database updates
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { folderId, customerName, customerEmail, prognoseAmount }: PaymentLinkRequest = await req.json();
    logStep("Request parsed", { folderId, customerName, prognoseAmount });

    if (!folderId || !customerName || !prognoseAmount) {
      throw new Error("Missing required fields: folderId, customerName, prognoseAmount");
    }

    // Calculate 30% fee in cents
    const feeAmount = Math.round(prognoseAmount * 0.30);
    const feeAmountCents = Math.round(feeAmount * 100);
    logStep("Fee calculated", { prognoseAmount, feeAmount, feeAmountCents });

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check if customer already exists in Stripe
    let customerId: string | undefined;
    if (customerEmail) {
      const customers = await stripe.customers.list({ email: customerEmail, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        logStep("Found existing Stripe customer", { customerId });
      }
    }

    // Create a Checkout session with dynamic price
    // Use Clairmont website for success/cancel redirects - customer should NOT see the internal software
    const clairmontWebsite = "https://clairmont-advisory.com";
    
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : customerEmail || undefined,
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: "Steuerberatungsgebühr",
              description: `Beratungsgebühr für ${customerName} (30% der geschätzten Erstattung von ${prognoseAmount.toFixed(2)} €)`,
            },
            unit_amount: feeAmountCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${clairmontWebsite}`,
      cancel_url: `${clairmontWebsite}`,
      metadata: {
        folder_id: folderId,
        customer_name: customerName,
        prognose_amount: prognoseAmount.toString(),
        fee_amount: feeAmount.toString(),
      },
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    // Update folder with payment link and status
    const { error: updateError } = await supabaseClient
      .from("folders")
      .update({
        payment_link_url: session.url,
        payment_status: "pending",
        prognose_amount: prognoseAmount,
        prognose_created_at: new Date().toISOString(),
      })
      .eq("id", folderId);

    if (updateError) {
      logStep("Error updating folder", { error: updateError.message });
      throw new Error(`Failed to update folder: ${updateError.message}`);
    }

    logStep("Folder updated with payment link");

    return new Response(
      JSON.stringify({ 
        success: true, 
        url: session.url,
        feeAmount,
        prognoseAmount,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
