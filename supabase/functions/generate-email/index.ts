import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerateEmailRequest {
  prompt: string;
  customerName: string;
  customerEmail: string;
  productType?: string | null;
  folderName?: string | null;
}

const productTypeLabels: Record<string, string> = {
  steuern: 'Steuern',
  kredit: 'Kredit',
  versicherung: 'Baufinanzierung',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, customerName, customerEmail, productType, folderName }: GenerateEmailRequest = await req.json();
    
    console.log("Generating email for customer:", customerName);
    console.log("User prompt:", prompt);
    console.log("Product type:", productType);
    console.log("Folder name:", folderName);

    // POST-LOVABLE-MIGRATION: use OpenAI instead of Lovable AI Gateway
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    // Fetch knowledge base entries
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let knowledgeBaseContext = "";
    
    // Fetch relevant knowledge base entries (general + product-specific)
    const { data: kbEntries, error: kbError } = await supabase
      .from("knowledge_base")
      .select("title, content, product_type, content_type")
      .or(`product_type.is.null,product_type.eq.${productType || 'steuern'}`);

    if (kbError) {
      console.error("Error fetching knowledge base:", kbError);
    } else if (kbEntries && kbEntries.length > 0) {
      console.log(`Found ${kbEntries.length} knowledge base entries`);
      
      // Only use text entries (PDFs would need OCR)
      const textEntries = kbEntries.filter(e => e.content_type === 'text' && e.content);
      
      if (textEntries.length > 0) {
        knowledgeBaseContext = `\n\nWISSENSBASIS (nutze dieses Wissen für deine Antworten):\n${textEntries.map(e => `### ${e.title}:\n${e.content}`).join('\n\n')}`;
      }
    }

    // Build context about the current case
    const productLabel = productType ? productTypeLabels[productType] || productType : null;
    let caseContext = "";
    
    if (productLabel) {
      caseContext = `\nAKTUELLER FALL: Der Kunde "${customerName}" wird im Bereich "${productLabel}" betreut.`;
      if (folderName) {
        caseContext += ` Ordnername: "${folderName}".`;
      }
    }

    const systemPrompt = `Du bist ein herzlicher, professioneller E-Mail-Assistent für Clairmont Advisory, eine Beratungsagentur für Steueroptimierung und Finanzfragen.

Deine Aufgabe ist es, freundliche, warme und professionelle E-Mails auf Deutsch zu verfassen.

Kundeninformationen:
- Name: ${customerName}
- E-Mail: ${customerEmail}
${caseContext}
${knowledgeBaseContext}

🚨 ABSOLUTE COMPLIANCE-REGEL — UNBRECHBAR:
Die Wörter "Steuerberatung", "Steuerberater", "Steuerberaterin", "steuerberatend" und alle Wortformen davon sind STRENG VERBOTEN. Clairmont Advisory ist KEIN zertifizierter Steuerberater und darf den Begriff aus rechtlichen Gründen nicht verwenden. Erlaubte Alternativen: "Steueroptimierung", "Steuer-Service", "Beratung", "Steuerexperten" (NIE "Steuerberater"!), "Steuerprofis", "Unterstützung bei Ihrer Steuererklärung", "wir helfen Ihnen bei Ihren Steuern".
Beispiele:
- ❌ "unsere Steuerberatung" → ✅ "unsere Beratung" oder "unser Steuer-Service"
- ❌ "unsere Steuerberater" → ✅ "unsere Steuerexperten" oder "unser Team"
- ❌ "steuerberatende Tätigkeit" → ✅ "Steueroptimierung"
Diese Regel gilt auch im Betreff und in allen Wortbildungen. Prüfe jeden Satz, bevor du ihn schreibst.

WICHTIGE REGELN FÜR DIE E-MAIL:
1. Beginne IMMER mit einer freundlichen Anrede wie "Guten Tag Herr/Frau ${customerName}," oder "Liebe/r ${customerName},"
2. Schreibe herzlich, warm und persönlich - nicht roboterhaft oder kalt
3. Verwende Absätze und Zeilenumbrüche für bessere Lesbarkeit
4. Beende die E-Mail IMMER mit einer warmen Grußformel wie:
   "Herzliche Grüße
   Ihr Team von Clairmont Advisory"
5. Die E-Mail sollte menschlich und einladend klingen
6. Sei hilfsbereit und zeige echtes Interesse am Kunden
7. WICHTIG: Wenn du über einen bestimmten Bereich schreibst (z.B. Steuern, Baufinanzierung, Kredit), nutze das Wissen aus der Wissensbasis.
8. ERFINDE NICHTS! Wenn du keine Informationen zu einem Thema hast, sage das ehrlich und biete an, dass sich ein Kollege melden wird.
9. Wenn der Nutzer sagt, dass ihr nicht helfen könnt, beziehe dich auf den aktuellen Bereich (${productLabel || 'unser Angebot'}).
10. Erinnerung an die Compliance-Regel oben: das Wort "Steuerberatung" und alle Wortformen davon DÜRFEN NICHT in deiner Antwort vorkommen. Diese Regel hat absolute Priorität.

Du musst SOWOHL einen passenden Betreff ALS AUCH die vollständige E-Mail-Nachricht generieren.

Antworte im folgenden JSON-Format:
{
  "subject": "Der passende Betreff für die E-Mail",
  "message": "Die vollständige E-Mail-Nachricht mit Anrede, Inhalt und Grußformel"
}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Schreibe eine E-Mail zum Thema: ${prompt}` },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add funds to your OpenAI account." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`OpenAI API error: ${response.status}`);
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
