import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

const serviceToProduct: Record<string, string> = {
  "steuerberatung": "steuern",
  "steueroptimierung-arbeitnehmer": "steuern",
  "global-sourcing": "global_sourcing",
  "unternehmensberatung": "unternehmensberatung",
  "ai-due-diligence": "ai_due_diligence",
  "payment-solutions": "payment_solutions",
  "solaranlagen": "solaranlagen",
  "immobilien": "immobilien",
  "rechtsberatung": "rechtsberatung",
  "sonstiges": "sonstiges",
};

interface ContactPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  service: string;
  subject: string;
  message?: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    const expectedSecret = Deno.env.get("CONTACT_WEBHOOK_SECRET");
    const providedSecret = authHeader?.replace("Bearer ", "");

    if (!providedSecret || providedSecret !== expectedSecret) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: ContactPayload = await req.json();

    const customerName = `${payload.firstName || ""} ${payload.lastName || ""}`.trim();
    if (!customerName) {
      return new Response(
        JSON.stringify({ error: "firstName and lastName are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const product = serviceToProduct[payload.service] || "sonstiges";
    const timestamp = new Date().toISOString().split("T")[0];
    const folderName = `${customerName} - ${timestamp}`;

    const { data: folder, error: folderError } = await supabase
      .from("folders")
      .insert({
        name: folderName,
        customer_name: customerName,
        customer_email: payload.email || null,
        product,
        status: "neu",
        partner_code: null,
        created_by: null,
      })
      .select()
      .single();

    if (folderError) {
      console.error("Error creating folder:", folderError);
      return new Response(
        JSON.stringify({ error: "Failed to create folder", details: folderError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Contact folder created: ${folder.id} (${product}) for ${customerName}`);

    return new Response(
      JSON.stringify({ success: true, folder_id: folder.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Contact webhook error:", msg);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
