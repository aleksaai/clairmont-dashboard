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
  installmentCount?: number;
  installmentFee?: number;
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

    const { 
      folderId, 
      customerName, 
      customerEmail, 
      prognoseAmount,
      installmentCount = 1,
      installmentFee = 0
    }: PaymentLinkRequest = await req.json();
    
    logStep("Request parsed", { folderId, customerName, prognoseAmount, installmentCount, installmentFee });

    if (!folderId || !customerName || !prognoseAmount) {
      throw new Error("Missing required fields: folderId, customerName, prognoseAmount");
    }

    // Calculate fee: 30% of prognose + installment fee
    const baseFee = Math.round(prognoseAmount * 0.30 * 100) / 100;
    const totalFee = baseFee + installmentFee;
    const totalFeeCents = Math.round(totalFee * 100);
    
    logStep("Fee calculated", { prognoseAmount, baseFee, installmentFee, totalFee, installmentCount });

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

    // Use Clairmont website for success/cancel redirects - customer should NOT see the internal software
    const clairmontWebsite = "https://clairmont-advisory.com";
    
    let sessionUrl: string | null = null;

    if (installmentCount > 1) {
      // Create a subscription for installment payments
      const perInstallmentAmount = Math.round(totalFeeCents / installmentCount);
      
      logStep("Creating subscription for installments", { installmentCount, perInstallmentAmount });

      // Create a price for the installment payments
      const product = await stripe.products.create({
        name: `Steuerberatungsgebühr für ${customerName}`,
        description: `Ratenzahlung: ${installmentCount} Raten à ${(perInstallmentAmount / 100).toFixed(2)} € (Erstattungsprognose: ${prognoseAmount.toFixed(2)} €)`,
      });

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: perInstallmentAmount,
        currency: "eur",
        recurring: {
          interval: "month",
          interval_count: 1,
        },
      });

      logStep("Created product and price", { productId: product.id, priceId: price.id });

      // Create checkout session for subscription
      // Note: cancel_at will be set via webhook after subscription is created
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        customer_email: customerId ? undefined : customerEmail || undefined,
        line_items: [
          {
            price: price.id,
            quantity: 1,
          },
        ],
        mode: "subscription",
        success_url: clairmontWebsite,
        cancel_url: clairmontWebsite,
        subscription_data: {
          metadata: {
            folder_id: folderId,
            customer_name: customerName,
            prognose_amount: prognoseAmount.toString(),
            total_fee: totalFee.toString(),
            installment_count: installmentCount.toString(),
          },
        },
        metadata: {
          folder_id: folderId,
          customer_name: customerName,
          prognose_amount: prognoseAmount.toString(),
          total_fee: totalFee.toString(),
          installment_count: installmentCount.toString(),
        },
      });

      sessionUrl = session.url;
      logStep("Subscription checkout session created", { sessionId: session.id, url: session.url });

    } else {
      // One-time payment (original flow)
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
              unit_amount: totalFeeCents,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: clairmontWebsite,
        cancel_url: clairmontWebsite,
        metadata: {
          folder_id: folderId,
          customer_name: customerName,
          prognose_amount: prognoseAmount.toString(),
          fee_amount: totalFee.toString(),
        },
      });

      sessionUrl = session.url;
      logStep("One-time checkout session created", { sessionId: session.id, url: session.url });
    }

    // Update folder with payment link and status
    const { error: updateError } = await supabaseClient
      .from("folders")
      .update({
        payment_link_url: sessionUrl,
        payment_status: "pending",
        prognose_amount: prognoseAmount,
        prognose_created_at: new Date().toISOString(),
        installment_count: installmentCount,
        installment_fee: installmentFee,
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
        url: sessionUrl,
        totalFee,
        prognoseAmount,
        installmentCount,
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
