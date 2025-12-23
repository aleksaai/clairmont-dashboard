import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string;
  subject: string;
  message: string;
  customerName: string;
  paymentLinkUrl?: string;
  feeAmount?: number;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, message, customerName, paymentLinkUrl, feeAmount }: EmailRequest = await req.json();

    console.log(`Sending email to: ${to}, subject: ${subject}`);
    console.log(`Payment link included: ${!!paymentLinkUrl}`);

    if (!to || !subject || !message) {
      console.error("Missing required fields");
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build CTA button HTML if payment link is provided
    let ctaButtonHtml = "";
    if (paymentLinkUrl) {
      // Updated button text since customer now chooses their payment method
      ctaButtonHtml = `
        <div style="text-align: center; margin: 32px 0;">
          <a href="${paymentLinkUrl}" 
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
            Zahlungsart wählen
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
