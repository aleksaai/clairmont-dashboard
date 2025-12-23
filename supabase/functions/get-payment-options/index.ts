import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GET-PAYMENT-OPTIONS] ${step}${detailsStr}`);
};

// Helper functions matching the frontend logic
const getMaxInstallments = (amount: number): number => {
  if (amount < 1000) return 2;
  if (amount < 3000) return 6;
  if (amount < 4500) return 9;
  return 0; // Individual consultation required
};

const requiresIndividualConsultation = (amount: number): boolean => {
  return amount >= 4500;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      throw new Error("Missing payment token");
    }

    logStep("Token received", { token });

    // Fetch folder by payment_selection_token
    const { data: folder, error: folderError } = await supabaseClient
      .from("folders")
      .select("id, customer_name, customer_email, prognose_amount, payment_status, installment_count, installment_fee")
      .eq("payment_selection_token", token)
      .single();

    if (folderError || !folder) {
      logStep("Folder not found", { error: folderError?.message });
      throw new Error("Invalid or expired payment link");
    }

    logStep("Folder found", { folderId: folder.id, customerName: folder.customer_name });

    if (!folder.prognose_amount) {
      throw new Error("No prognosis amount set for this case");
    }

    // Check if already paid
    if (folder.payment_status === "paid") {
      return new Response(
        JSON.stringify({
          success: true,
          alreadyPaid: true,
          customerName: folder.customer_name,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const prognoseAmount = Number(folder.prognose_amount);
    const baseFee = Math.round(prognoseAmount * 0.30 * 100) / 100;
    const maxInstallments = getMaxInstallments(prognoseAmount);
    const needsConsultation = requiresIndividualConsultation(prognoseAmount);

    // Generate available payment options
    const paymentOptions = [];

    if (!needsConsultation) {
      // Single payment option
      paymentOptions.push({
        installments: 1,
        totalAmount: baseFee,
        perInstallment: baseFee,
        surcharge: 0,
        label: "Einmalzahlung",
      });

      // Installment options
      for (let i = 2; i <= maxInstallments; i++) {
        const surcharge = i * 10;
        const totalWithSurcharge = baseFee + surcharge;
        const perInstallment = Math.round((totalWithSurcharge / i) * 100) / 100;
        
        paymentOptions.push({
          installments: i,
          totalAmount: totalWithSurcharge,
          perInstallment,
          surcharge,
          label: `${i} Raten`,
        });
      }
    }

    logStep("Payment options generated", { optionsCount: paymentOptions.length, maxInstallments });

    return new Response(
      JSON.stringify({
        success: true,
        alreadyPaid: false,
        folderId: folder.id,
        customerName: folder.customer_name,
        customerEmail: folder.customer_email,
        prognoseAmount,
        baseFee,
        paymentOptions,
        needsConsultation,
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
