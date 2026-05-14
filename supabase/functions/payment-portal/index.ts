// Customer-facing Payment Portal
//
// Serves an HTML page where the customer chooses between one-time payment and
// an installment plan. Lookup is by `payment_token` (UUID), which is permanent
// per folder — unlike Stripe Checkout sessions which expire after 24h.
//
// Triggered by a Netlify redirect on the public site:
//   https://clairmont-advisory.com/pay?t=<uuid>  →  this function
//
// Click on a plan → POST /select  →  creates Stripe Checkout Session
// (via the existing create-payment-link function) and returns its URL.
// The inline JS then redirects the browser to Stripe.
//
// Deployed with `verify_jwt: false` because the customer has no Supabase auth.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } }
);

// Match the dashboard's installment rules: fee = 30% of refund,
// max installments depend on the fee bracket (1 → 9 per Zahlungsplan).
function getInstallmentOptions(prognoseAmount: number): number[] {
  const feeAmount = prognoseAmount * 0.30;
  if (feeAmount >= 900) return [1, 3, 6, 9];      // refund >= 3.000 €
  if (feeAmount >= 300) return [1, 3, 6];          // refund >= 1.000 €
  return [1, 2];                                    // smaller refunds
}

function fmtEur(n: number): string {
  return n.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const BRAND_PRIMARY = "#1F3D5C";
const BRAND_PRIMARY_DARK = "#16304A";
const BRAND_SURFACE = "#F7F9FB";
const LOGO_URL = "https://clairmont-advisory.com/logo.png";

function pageShell(title: string, body: string): string {
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} — Clairmont Advisory</title>
  <link rel="icon" href="${LOGO_URL}">
  <style>
    *,*::before,*::after{box-sizing:border-box}
    html,body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color:#0F1B2A;background:${BRAND_SURFACE};-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
    a{color:${BRAND_PRIMARY};text-decoration:none}
    .wrap{max-width:880px;margin:0 auto;padding:32px 20px 80px}
    header{display:flex;align-items:center;justify-content:flex-start;padding:8px 0 32px}
    header img{height:36px;width:auto}
    .hero{background:#fff;border-radius:12px;padding:36px 28px;box-shadow:0 1px 2px rgba(15,27,42,0.04),0 1px 3px rgba(15,27,42,0.06)}
    h1{font-size:24px;line-height:1.25;margin:0 0 8px;font-weight:600;color:${BRAND_PRIMARY}}
    .lead{font-size:16px;color:#475569;margin:0 0 24px;line-height:1.6}
    .summary{background:${BRAND_SURFACE};border:1px solid #E5EAF0;border-radius:10px;padding:18px 20px;display:flex;flex-direction:column;gap:8px;margin:0 0 8px}
    .summary .row{display:flex;justify-content:space-between;align-items:baseline;font-size:14px}
    .summary .row .label{color:#64748B}
    .summary .row .val{font-weight:600;color:#0F1B2A}
    .summary .row.total{padding-top:8px;border-top:1px solid #E5EAF0;font-size:15px}
    .options{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin:28px 0 8px}
    .option{background:#fff;border:1px solid #E5EAF0;border-radius:12px;padding:20px 18px;display:flex;flex-direction:column;gap:6px;cursor:pointer;transition:transform .12s ease,box-shadow .12s ease,border-color .12s ease;text-align:left;font:inherit;color:inherit}
    .option:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(15,27,42,0.08);border-color:${BRAND_PRIMARY}}
    .option:disabled{cursor:wait;opacity:.7}
    .option .tag{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:${BRAND_PRIMARY};font-weight:600}
    .option .title{font-size:18px;font-weight:600;margin:4px 0 2px;color:#0F1B2A}
    .option .price{font-size:20px;font-weight:700;color:${BRAND_PRIMARY};margin:6px 0 4px}
    .option .meta{font-size:13px;color:#64748B;line-height:1.5}
    .option .cta{margin-top:12px;background:${BRAND_PRIMARY};color:#fff;border:none;border-radius:8px;padding:10px 14px;font-size:14px;font-weight:600;cursor:pointer;text-align:center;transition:background .12s ease}
    .option:hover .cta{background:${BRAND_PRIMARY_DARK}}
    .note{font-size:13px;color:#64748B;margin:18px 0 0;line-height:1.6}
    .footer{margin-top:36px;padding:16px 0 0;border-top:1px solid #E5EAF0;font-size:12px;color:#94A3B8;text-align:center}
    .footer a{color:#64748B}
    .pill{display:inline-block;background:#E8F1FF;color:${BRAND_PRIMARY};border-radius:999px;padding:4px 12px;font-size:12px;font-weight:600;letter-spacing:.02em;margin:0 0 12px}
    .icon{display:inline-block;width:48px;height:48px;border-radius:50%;background:#E8F1FF;color:${BRAND_PRIMARY};font-size:24px;display:flex;align-items:center;justify-content:center;margin:0 0 12px}
    .center{text-align:center}
    .error-card{background:#fff;border-radius:12px;padding:48px 28px;text-align:center;box-shadow:0 1px 2px rgba(15,27,42,0.04),0 1px 3px rgba(15,27,42,0.06)}
    .error-card h1{margin-bottom:12px}
    .spinner{display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:spin .8s linear infinite;vertical-align:-2px;margin-right:6px}
    @keyframes spin{to{transform:rotate(360deg)}}
    @media(max-width:560px){
      .wrap{padding:20px 14px 60px}
      h1{font-size:22px}
      .hero{padding:28px 22px}
      .options{grid-template-columns:1fr}
    }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <img src="${LOGO_URL}" alt="Clairmont Advisory">
    </header>
    ${body}
    <div class="footer">
      Clairmont Advisory &amp; Partners L.L.C-FZ &middot; <a href="https://clairmont-advisory.com">clairmont-advisory.com</a>
    </div>
  </div>
</body>
</html>`;
}

function renderNotFound(): string {
  return pageShell("Angebot nicht gefunden", `
    <div class="error-card">
      <h1>Angebot nicht gefunden</h1>
      <p class="lead">Dieser Zahlungslink ist ungültig oder wurde entfernt. Bitte wenden Sie sich an Ihre Ansprechpartnerin bei Clairmont Advisory.</p>
    </div>
  `);
}

function renderNotReady(customerName: string): string {
  return pageShell("Angebot in Vorbereitung", `
    <div class="error-card">
      <h1>Ihr Angebot wird vorbereitet</h1>
      <p class="lead">Hallo ${escapeHtml(customerName)},<br>Ihr Angebot ist noch in der Erstellung. Sobald es fertig ist, erhalten Sie eine E-Mail mit allen Details. Vielen Dank für Ihre Geduld.</p>
    </div>
  `);
}

function renderPaid(customerName: string, paidAt: string | null): string {
  const dateStr = paidAt
    ? new Date(paidAt).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })
    : null;
  return pageShell("Bezahlt", `
    <div class="error-card">
      <div class="icon">✓</div>
      <h1>Vielen Dank, ${escapeHtml(customerName)}!</h1>
      <p class="lead">Ihre Zahlung ist bei uns eingegangen${dateStr ? ` (${escapeHtml(dateStr)})` : ""}. Wir kümmern uns ab sofort um Ihre Steuererklärung und melden uns mit den nächsten Schritten.</p>
    </div>
  `);
}

function renderSelector(folder: {
  customer_name: string;
  prognose_amount: number;
  payment_token: string;
}): string {
  const prognose = Number(folder.prognose_amount);
  const baseFee = prognose * 0.30;
  const options = getInstallmentOptions(prognose);

  const cards = options.map((count) => {
    if (count === 1) {
      return `
        <button class="option" data-installments="1" onclick="handleSelect(this)">
          <span class="tag">Empfohlen</span>
          <span class="title">Einmalzahlung</span>
          <span class="price">${escapeHtml(fmtEur(baseFee))}</span>
          <span class="meta">Eine Zahlung &middot; ohne Aufschlag</span>
          <span class="cta">Jetzt bezahlen</span>
        </button>`;
    }
    const installmentFee = count * 10;
    const totalFee = baseFee + installmentFee;
    const perRate = totalFee / count;
    return `
      <button class="option" data-installments="${count}" onclick="handleSelect(this)">
        <span class="tag">${count} Raten</span>
        <span class="title">Ratenzahlung</span>
        <span class="price">${escapeHtml(fmtEur(perRate))}<span style="font-size:14px;color:#64748B;font-weight:500"> / Monat</span></span>
        <span class="meta">${count} × ${escapeHtml(fmtEur(perRate))} &middot; +${escapeHtml(fmtEur(installmentFee))} Ratenaufschlag<br>Gesamt: ${escapeHtml(fmtEur(totalFee))}</span>
        <span class="cta">Ratenplan starten</span>
      </button>`;
  }).join("");

  const body = `
    <div class="hero">
      <span class="pill">Ihr Angebot</span>
      <h1>Hallo ${escapeHtml(folder.customer_name)},</h1>
      <p class="lead">basierend auf Ihren Unterlagen schätzen wir Ihre Steuererstattung auf <strong>${escapeHtml(fmtEur(prognose))}</strong>. Sie können selbst entscheiden, wie Sie unsere Beratungsgebühr (30&nbsp;%) zahlen möchten.</p>
      <div class="summary">
        <div class="row"><span class="label">Geschätzte Steuererstattung</span><span class="val">${escapeHtml(fmtEur(prognose))}</span></div>
        <div class="row"><span class="label">Beratungsgebühr (30 %)</span><span class="val">${escapeHtml(fmtEur(baseFee))}</span></div>
      </div>
      <div class="options">
        ${cards}
      </div>
      <p class="note">
        Sie werden für die Zahlung sicher zu unserem Zahlungspartner Stripe weitergeleitet. Bei Fragen erreichen Sie uns jederzeit per E-Mail an
        <a href="mailto:info@clairmont-advisory.com">info@clairmont-advisory.com</a>.
      </p>
    </div>
    <script>
      const TOKEN = ${JSON.stringify(folder.payment_token)};
      const SELECT_URL = window.location.pathname.replace(/\\/+$/, '') + '/select';
      // When proxied via Netlify, the path is /pay → /pay/select isn't routed; we instead post back to the same URL.
      async function handleSelect(btn) {
        if (btn.disabled) return;
        const installments = parseInt(btn.dataset.installments, 10);
        const original = btn.querySelector('.cta').innerHTML;
        btn.disabled = true;
        btn.querySelector('.cta').innerHTML = '<span class="spinner"></span>Weiterleiten…';
        try {
          const res = await fetch(window.location.href, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: TOKEN, installmentCount: installments }),
          });
          const data = await res.json();
          if (!res.ok || !data.url) throw new Error(data.error || 'Fehler beim Erstellen der Zahlung');
          window.location.href = data.url;
        } catch (err) {
          btn.disabled = false;
          btn.querySelector('.cta').innerHTML = original;
          alert('Es gab ein Problem beim Vorbereiten der Zahlung. Bitte versuchen Sie es noch einmal oder kontaktieren Sie uns per E-Mail.\\n\\n' + (err && err.message ? err.message : ''));
        }
      }
    </script>
  `;
  return pageShell("Ihr Angebot", body);
}

async function createPaymentSession(token: string, installmentCount: number): Promise<{ url: string } | { error: string }> {
  // Resolve folder by token, then delegate to the existing create-payment-link
  // function so we keep one source of truth for Stripe session creation.
  const { data: folder, error } = await supabase
    .from("folders")
    .select("id, customer_name, customer_email, prognose_amount")
    .eq("payment_token", token)
    .single();

  if (error || !folder) return { error: "Angebot nicht gefunden." };
  if (!folder.prognose_amount) return { error: "Angebot ist noch nicht freigegeben." };

  const installmentFee = installmentCount > 1 ? installmentCount * 10 : 0;

  const projectUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  const res = await fetch(`${projectUrl}/functions/v1/create-payment-link`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${anonKey}`,
    },
    body: JSON.stringify({
      folderId: folder.id,
      customerName: folder.customer_name,
      customerEmail: folder.customer_email,
      prognoseAmount: Number(folder.prognose_amount),
      installmentCount,
      installmentFee,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("create-payment-link failed:", res.status, text);
    return { error: "Zahlungssitzung konnte nicht erstellt werden." };
  }
  const data = await res.json();
  if (!data?.url) return { error: "Keine Zahlungs-URL erhalten." };
  return { url: data.url };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const token = url.searchParams.get("t");

  // POST = customer picked a plan, create Stripe session.
  if (req.method === "POST") {
    try {
      const body = await req.json();
      const result = await createPaymentSession(body.token ?? token ?? "", Number(body.installmentCount) || 1);
      return new Response(JSON.stringify(result), {
        status: "error" in result ? 400 : 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return new Response(JSON.stringify({ error: msg }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // GET = render the portal page.
  const htmlHeaders = { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" };

  if (!token) {
    return new Response(renderNotFound(), { status: 404, headers: htmlHeaders });
  }

  const { data: folder, error } = await supabase
    .from("folders")
    .select("customer_name, prognose_amount, payment_status, payment_token, updated_at")
    .eq("payment_token", token)
    .single();

  if (error || !folder) {
    return new Response(renderNotFound(), { status: 404, headers: htmlHeaders });
  }

  if (folder.payment_status === "paid") {
    return new Response(renderPaid(folder.customer_name, folder.updated_at), { status: 200, headers: htmlHeaders });
  }

  if (!folder.prognose_amount || Number(folder.prognose_amount) <= 0) {
    return new Response(renderNotReady(folder.customer_name), { status: 200, headers: htmlHeaders });
  }

  return new Response(renderSelector({
    customer_name: folder.customer_name,
    prognose_amount: Number(folder.prognose_amount),
    payment_token: folder.payment_token,
  }), { status: 200, headers: htmlHeaders });
});
