import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  type: "new_customer" | "status_change" | "chat_message";
  partnerCode?: string | null;
  customerName?: string;
  productType?: string;
  newStatus?: string;
  senderName?: string;
  messagePreview?: string;
  // For direct Vertriebler lookup (chat messages)
  vertrieblerUserId?: string;
}

const statusLabels: Record<string, string> = {
  neu: "Neu / Anfrage",
  bezahlt: "Bezahlt",
  abgeschickt: "Abgeschickt",
  in_bearbeitung: "In Bearbeitung",
  abgeschlossen: "Abgeschlossen",
  einspruch: "Einspruch",
  anfrage_eingegangen: "Anfrage eingegangen",
  prognose_erstellt: "Prognose erstellt",
  angebot_gesendet: "Angebot gesendet",
  anzahlung_erhalten: "Anzahlung erhalten",
  rueckstand: "Rückstand",
  einspruch_nacharbeit: "Einspruch / Nacharbeit",
};

const productLabels: Record<string, string> = {
  steuern: "Steuerfälle",
  kredit: "Kreditfälle",
  versicherung: "Baufinanzierungsfälle",
  problemfall: "Problemfälle",
};

const APP_URL = "https://app.clairmont-advisory.com";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: NotificationRequest = await req.json();
    console.log("Notify Vertriebler request:", JSON.stringify(payload));

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Determine Vertriebler email(s) to notify
    let vertrieblerEmails: { email: string; name: string | null }[] = [];

    if (payload.vertrieblerUserId) {
      // Direct user ID lookup (for chat messages)
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", payload.vertrieblerUserId)
        .single();
      
      if (profile) {
        vertrieblerEmails.push({ email: profile.email, name: profile.full_name });
      }
    } else if (payload.partnerCode) {
      // Lookup via partner code
      const { data: partnerCodes } = await supabase
        .from("partner_codes")
        .select("user_id")
        .eq("code", payload.partnerCode);

      if (partnerCodes && partnerCodes.length > 0) {
        const userIds = partnerCodes.map((pc) => pc.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("email, full_name")
          .in("id", userIds);

        if (profiles) {
          vertrieblerEmails = profiles.map((p) => ({ email: p.email, name: p.full_name }));
        }
      }
    }

    if (vertrieblerEmails.length === 0) {
      console.log("No Vertriebler found to notify");
      return new Response(
        JSON.stringify({ success: true, message: "No Vertriebler to notify" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build email content based on type
    for (const vertriebler of vertrieblerEmails) {
      const greeting = vertriebler.name ? `Hallo ${vertriebler.name.split(" ")[0]}` : "Hallo";
      let subject = "";
      let bodyContent = "";
      let ctaText = "";
      let ctaUrl = APP_URL;

      switch (payload.type) {
        case "new_customer": {
          const productLabel = productLabels[payload.productType || "steuern"] || payload.productType;
          subject = `Neuer Kunde: ${payload.customerName}`;
          bodyContent = `${greeting},

ein neuer Kunde hat sich über deinen Partnercode registriert.

<strong>Kunde:</strong> ${payload.customerName}
<strong>Kategorie:</strong> ${productLabel}

Der Kundenordner wurde automatisch angelegt und du kannst ihn ab sofort im Drive einsehen.`;
          ctaText = "Zum Drive";
          break;
        }

        case "status_change": {
          const statusLabel = statusLabels[payload.newStatus || ""] || payload.newStatus;
          subject = `Statusänderung: ${payload.customerName} → ${statusLabel}`;
          bodyContent = `${greeting},

der Status eines deiner Kunden wurde aktualisiert.

<strong>Kunde:</strong> ${payload.customerName}
<strong>Neuer Status:</strong> ${statusLabel}

Du kannst den Fall im Drive einsehen.`;
          ctaText = "Zum Drive";
          break;
        }

        case "chat_message": {
          subject = `Neue Nachricht von ${payload.senderName || "einem Teammitglied"}`;
          const preview = payload.messagePreview && payload.messagePreview.length > 100
            ? payload.messagePreview.substring(0, 100) + "..."
            : payload.messagePreview || "";
          bodyContent = `${greeting},

du hast eine neue Nachricht erhalten.

<strong>Von:</strong> ${payload.senderName || "Teammitglied"}
${preview ? `<strong>Nachricht:</strong> "${preview}"` : ""}

Antworten kannst du direkt im Chat.`;
          ctaText = "Zum Chat";
          break;
        }
      }

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="color: #333; line-height: 1.8; white-space: pre-wrap; font-size: 15px;">
${bodyContent}
          </div>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${ctaUrl}" 
               target="_blank"
               style="display: inline-block; 
                      background-color: #2563eb; 
                      color: #ffffff; 
                      text-decoration: none; 
                      padding: 16px 32px; 
                      border-radius: 8px; 
                      font-size: 16px; 
                      font-weight: 600;
                      box-shadow: 0 4px 6px rgba(37, 99, 235, 0.25);">
              ${ctaText}
            </a>
          </div>
        </div>
      `;

      try {
        const emailResponse = await resend.emails.send({
          from: "Clairmont Advisory <noreply@tax.clairmont-advisory.com>",
          to: [vertriebler.email],
          subject: subject,
          html: htmlContent,
        });
        console.log(`Notification sent to ${vertriebler.email}:`, emailResponse);
      } catch (emailError) {
        console.error(`Failed to send notification to ${vertriebler.email}:`, emailError);
      }
    }

    return new Response(
      JSON.stringify({ success: true, notified: vertrieblerEmails.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in notify-vertriebler:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
