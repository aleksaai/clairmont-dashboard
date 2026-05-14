import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Compliance hard filter — Clairmont is not a certified tax advisor and may
// not use the protected term "Steuerberatung" / "Steuerberater" in any form
// in customer-facing communication. This is the last line of defence: it
// runs on subject AND message right before the email is dispatched, so it
// catches both AI hallucinations and manual typing by sales staff.
function sanitizeForbiddenTerms(input: string): string {
  if (!input) return input;
  // Longest matches first — Steuerberatungs > Steuerberatung; Steuerberaterinnen > Steuerberaterin etc.
  const rules: Array<[RegExp, string | ((m: string, s: string) => string)]> = [
    [/Steuerberatungs/g, "Beratungs"],
    [/steuerberatungs/g, "beratungs"],
    [/Steuerberatung(en|s)?/g, (_m, s: string) => `Beratung${s || ""}`],
    [/steuerberatung(en|s)?/g, (_m, s: string) => `beratung${s || ""}`],
    [/Steuerberaterinnen/g, "Steuerexpertinnen"],
    [/steuerberaterinnen/g, "steuerexpertinnen"],
    [/Steuerberaterin/g, "Steuerexpertin"],
    [/steuerberaterin/g, "steuerexpertin"],
    [/Steuerberater[ns]/g, "Steuerexperten"],
    [/steuerberater[ns]/g, "steuerexperten"],
    [/Steuerberater/g, "Steuerexperte"],
    [/steuerberater/g, "steuerexperte"],
    [/Steuerberatend/g, "Beratend"],
    [/steuerberatend/g, "beratend"],
  ];
  let out = input;
  for (const [re, repl] of rules) {
    out = out.replace(re, repl as never);
  }
  return out;
}

interface EmailRequest {
  to: string;
  subject: string;
  message: string;
  customerName: string;
  paymentLinkUrl?: string;
  // Kept for backwards compatibility with any old caller, but ignored — the
  // CTA button no longer hardcodes a euro amount because the customer picks
  // the payment plan on the portal.
  feeAmount?: number;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const raw: EmailRequest = await req.json();
    const { to, customerName, paymentLinkUrl } = raw;

    // Hard compliance filter — runs on subject + body before anything else.
    const subject = sanitizeForbiddenTerms(raw.subject);
    const message = sanitizeForbiddenTerms(raw.message);
    if (subject !== raw.subject || message !== raw.message) {
      console.warn("[compliance] sanitized 'Steuerberatung*' term(s) before sending");
    }

    console.log(`Sending email to: ${to}, subject: ${subject}`);
    console.log(`Payment link included: ${!!paymentLinkUrl}`);

    if (!to || !subject || !message) {
      console.error("Missing required fields");
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build CTA button HTML if a payment-portal URL is provided.
    // The button text intentionally avoids a hardcoded euro amount because
    // the customer chooses one-time vs. installments on the portal page.
    let ctaButtonHtml = "";
    if (paymentLinkUrl) {
      ctaButtonHtml = `
        <div style="text-align: center; margin: 32px 0;">
          <a href="${paymentLinkUrl}"
             target="_blank"
             style="display: inline-block;
                    background-color: #1F3D5C;
                    color: #ffffff;
                    text-decoration: none;
                    padding: 16px 32px;
                    border-radius: 8px;
                    font-size: 16px;
                    font-weight: 600;
                    box-shadow: 0 4px 6px rgba(31, 61, 92, 0.25);">
            Angebot ansehen &amp; Zahlart wählen
          </a>
        </div>
      `;
    }

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="color: #333; line-height: 1.8; white-space: pre-wrap; font-size: 15px;">
${message}
        </div>
        ${ctaButtonHtml}
      </div>
    `;

    const emailResponse = await resend.emails.send({
      from: "Clairmont Advisory <noreply@tax.clairmont-advisory.com>",
      to: [to],
      subject: subject,
      html: htmlContent,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-email function:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
