import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerateEmailRequest {
  prompt: string;
  customerName: string;
  customerEmail: string;
  context?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, customerName, customerEmail, context }: GenerateEmailRequest = await req.json();
    
    console.log("Generating email for customer:", customerName);
    console.log("User prompt:", prompt);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `Du bist ein herzlicher, professioneller E-Mail-Assistent für Clairmont Advisory, eine Steuer- und Finanzberatungsagentur.

Deine Aufgabe ist es, freundliche, warme und professionelle E-Mails auf Deutsch zu verfassen.

Kundeninformationen:
- Name: ${customerName}
- E-Mail: ${customerEmail}
${context ? `- Kontext: ${context}` : ''}

WICHTIGE REGELN FÜR DIE E-MAIL:
1. Beginne IMMER mit einer freundlichen Anrede wie "Guten Tag Herr/Frau ${customerName}," oder "Liebe/r ${customerName},"
2. Schreibe herzlich, warm und persönlich - nicht roboterhaft oder kalt
3. Verwende Absätze und Zeilenumbrüche für bessere Lesbarkeit
4. Beende die E-Mail IMMER mit einer warmen Grußformel wie:
   "Herzliche Grüße
   Ihr Team von Clairmont Advisory"
5. Die E-Mail sollte menschlich und einladend klingen
6. Sei hilfsbereit und zeige echtes Interesse am Kunden

Du musst SOWOHL einen passenden Betreff ALS AUCH die vollständige E-Mail-Nachricht generieren.

Antworte im folgenden JSON-Format:
{
  "subject": "Der passende Betreff für die E-Mail",
  "message": "Die vollständige E-Mail-Nachricht mit Anrede, Inhalt und Grußformel"
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Schreibe eine E-Mail zum Thema: ${prompt}` },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add funds to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const generatedContent = data.choices?.[0]?.message?.content || "";

    console.log("Raw AI response:", generatedContent);

    // Parse the JSON response
    let subject = "";
    let message = "";
    
    try {
      // Try to parse as JSON
      const jsonMatch = generatedContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        subject = parsed.subject || "";
        message = parsed.message || "";
      } else {
        // Fallback: use the whole response as message
        message = generatedContent;
      }
    } catch (parseError) {
      console.log("Could not parse as JSON, using raw response");
      message = generatedContent;
    }

    console.log("Email generated successfully - Subject:", subject);

    return new Response(
      JSON.stringify({ subject, message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in generate-email function:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
