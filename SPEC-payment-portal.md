# SPEC — Customer-facing Payment Portal

**Status:** Draft v1 — 2026-05-14
**Author:** Marcus (with Aleksa)
**Repos affected:** `clairmont-dashboard` (this repo), `clairmont-website` (Netlify redirect only)

---

## Problem

Der Vertriebler entscheidet aktuell im Dashboard, ob ein Angebot als Einmal- oder Ratenzahlung an den Kunden gesendet wird. Daraus folgen drei Schmerzpunkte:

1. **Stripe-Checkout-Session läuft nach ~24h ab** — wenn der Kunde die Email zu spät öffnet, klickt er auf einen toten Link, Vertriebler muss neu senden.
2. **Abstimmungs-Overhead** — Vertriebler muss vorab mit Kunde klären, welche Zahlart bevorzugt wird. Bei Sinneswandel: alles neu.
3. **Email-Diskrepanz** — drei konkrete Bugs (heute, 2026-05-14 diagnostiziert) führen dazu, dass selbst bei eingestellter Ratenzahlung die Email die Einmal-Summe zeigt:
   - `EmailDialog.tsx:54-56` — OpenAI-Prompt erwähnt Ratenzahlung mit keinem Wort
   - `EmailDialog.tsx:170` — `feeAmount = prognose * 0.30` ignoriert den Ratenaufschlag
   - `send-email/index.ts:57` — CTA-Button sagt immer "Jetzt X € bezahlen", egal ob Subscription

## Solution

Der Kunde wählt selbst. Die Email enthält einen **permanenten Token-Link** auf eine **Zahlungs-Auswahl-Seite**, die unter `tax.clairmont-advisory.com/pay?t=<uuid>` gehostet wird (Netlify proxied auf Supabase Edge Function). Auf der Seite sieht der Kunde sein Angebot und wählt zwischen Einmal- und Ratenzahlung. Die Stripe-Session wird **erst nach seinem Klick** erzeugt — Link kann nicht mehr veralten.

## User Flows

### Vertriebler-Flow (vereinfacht)
1. Prognose-Dialog: nur noch Erstattungssumme eingeben — **Zahlart-Auswahl entfällt**.
2. "Angebot senden" → Backend erzeugt `payment_token` (UUID) für den Folder, setzt Status `angebot_gesendet`.
3. Email-Dialog öffnet im Offer-Mode mit KI-vorgeneriertem Text. Button in der Email = `https://tax.clairmont-advisory.com/pay?t=<token>`.
4. Vertriebler sendet ab. Fertig.

### Kunden-Flow
1. Email kommt rein → klickt auf "Ihr Angebot ansehen".
2. Landet auf der Auswahl-Seite mit:
   - Clairmont-Logo + Brand-Farben (Marine `#1F3D5C`)
   - Anrede ("Hallo {Name}")
   - Geschätzte Erstattung
   - Zwei (bis vier) Zahlungs-Optionen als Karten je nach Erstattungshöhe:
     - **Einmalzahlung** — Beratungsgebühr (30% der Erstattung)
     - **2 Raten** (bei Erstattung ≥ 0 €)
     - **6 Raten** (bei Erstattung ≥ 1.000 €)
     - **9 Raten** (bei Erstattung ≥ 3.000 €)
   - Jede Raten-Karte zeigt: Monatsrate, Anzahl Raten, Aufschlag (10 €/Rate), Gesamtsumme
3. Klick auf eine Karte → erzeugt **on-demand** die passende Stripe-Checkout-Session → redirect zur Stripe-Seite.
4. Kunde bezahlt auf Stripe → Stripe-Webhook updated `payment_status` in `folders`.
5. Falls Kunde später nochmal auf die Auswahl-Seite kommt: sie zeigt "Bezahlt am {Datum}" statt Buttons.

### Storno-Verhalten (per Aleksa-Entscheidung 2026-05-14)
Wenn der Vertriebler die Prognose nach dem Versand ändert, ändert sich automatisch was der Kunde auf der Seite sieht. Kein Lock. Akzeptiert.

## Data Model

### Schema-Änderung — `folders`-Tabelle

| Spalte | Aktion | Notiz |
|---|---|---|
| `payment_token` | **NEU** — `uuid`, `unique`, `not null default gen_random_uuid()` | Der permanente Lookup-Key für die Auswahl-Seite. Wird einmalig pro Folder generiert. |
| `payment_link_url` | bleibt, semantisch unverändert | Wird jetzt erst nach Kunden-Klick beschrieben; vorher `null`. |
| `installment_count` | bleibt | Vertriebler-Entscheidung entfällt — wird auf `1` (oder NULL) gesetzt bis Kunde wählt. |
| `installment_fee` | bleibt | dito |

### Migration
`supabase/migrations/20260514120000_payment_token.sql`:
```sql
ALTER TABLE folders
  ADD COLUMN payment_token uuid NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX idx_folders_payment_token ON folders(payment_token);
```

(Default sorgt dafür, dass alle existierenden Folders sofort einen Token kriegen — kein Backfill nötig.)

## Components

### Edge Function: `payment-portal` (NEU, HTML response)
- Path: `supabase/functions/payment-portal/index.ts`
- `verify_jwt: false` (öffentliche Customer-Seite)
- Input: `?t=<uuid>` query param
- Logic:
  1. Folder per `payment_token` lesen (Service Role Key, RLS umgehen)
  2. Wenn nicht gefunden → 404-HTML mit Brand
  3. Wenn `payment_status === 'paid'` → "Bezahlt am X" HTML
  4. Sonst → Auswahl-Seite-HTML mit dynamischen Raten-Optionen (gleiche Regeln wie `PrognoseDialog.getMaxInstallments`)
- Output: vollständiges HTML (inline CSS für Brand, kein externes Asset außer Logo-PNG)
- Klick-Handler (inline JS): POST zu `create-payment-link` mit `{ token, installmentCount }` → `data.url` → `window.location = data.url`

### Edge Function: `create-payment-link` (ANPASSEN)
- Input ändert sich: statt `{folderId, customerName, customerEmail, prognoseAmount, installmentCount, installmentFee}` jetzt **nur noch** `{paymentToken, installmentCount}`. Alles andere wird aus der DB gelesen — keine Frontend-Werte mehr.
- Wird ab jetzt von der Auswahl-Seite gerufen, nicht mehr vom Dashboard.
- Bestehende Stripe-Logik (`mode: subscription` vs `mode: payment`, Fees, Metadata) bleibt gleich.
- `installmentFee` wird intern aus `installmentCount * 10` berechnet, nicht mehr akzeptiert.

### `OrdnerView.tsx` (ANPASSEN)
- `handleSendOffer` ruft nicht mehr `create-payment-link` auf. Stattdessen:
  1. Liest `payment_token` aus dem Folder (existiert immer wegen DB-Default)
  2. Baut `portalUrl = https://tax.clairmont-advisory.com/pay?t=<token>`
  3. Updated `folders` mit `status: 'angebot_gesendet'`, `prognose_created_at: now()`
  4. Öffnet Email-Dialog im Offer-Mode mit `portalUrl` als `paymentLinkUrl`-Property
- Toast-Text reduziert sich auf "Angebot bereit".
- Im rechten Panel: der "Zahlungslink kopieren"-Button kopiert ab jetzt die Portal-URL (Token-Link), nicht mehr die Stripe-Session-URL.

### `PrognoseDialog.tsx` (VEREINFACHEN)
- Komplett raus: das `<Select>` für Ratenzahl, der `installments`-State, `getMaxInstallments`, alle Raten-Hinweise.
- Bleibt: Erstattungs-Input, Fee-Anzeige (30 %), Save-Button.
- DB-Write setzt `installment_count: 1`, `installment_fee: 0` als sichere Defaults.

### `EmailDialog.tsx` (VEREINFACHEN)
- `handleGenerateOfferEmail` Prompt wird neutral: "Erstelle ein Angebot. Erstattungs-Prognose X €. Beratungsgebühr 30 % der Erstattung. Der Kunde wählt selbst auf der Zahlungsseite zwischen Einmal- und Ratenzahlung. Erwähne diese Wahlmöglichkeit. Füge keinen Link ein — der Button kommt automatisch."
- `handleSendEmail` `feeAmount`-Berechnung bleibt (wird nur noch für den Email-Text-Hinweis genutzt, nicht für den Button).
- `send-email` Aufruf kriegt jetzt `portalUrl` als `paymentLinkUrl`. Sonst unverändert.

### `send-email/index.ts` (MINIMAL ANPASSEN)
- CTA-Button-Text: bei `paymentLinkUrl` ohne Geld-Suffix → "Ihr Angebot ansehen" (nicht mehr "Jetzt X € bezahlen", weil der Betrag ja noch nicht final ist).
- Keine breaking changes — `feeAmount` darf weiterhin optional sein.

### `clairmont-website` `netlify.toml` (1 Zeile)
```toml
[[redirects]]
  from = "/pay"
  to = "https://znltfcxpngtztiwbcamm.supabase.co/functions/v1/payment-portal"
  status = 200
  force = true
```

## Brand of Auswahl-Seite

- **Logo:** `clairmont-website/public/logo.png` → ins Dashboard `public/` kopieren ODER per `<img>` von Website-Domain referenzieren.
- **Primary:** `#1F3D5C` (HSL 208 48% 23%)
- **Background:** white, light section dividers (`#F7F9FB`)
- **Typography:** system-sans-stack (matches Website)
- **Border-Radius:** 8px
- **Style:** klar, trust-vermittelnd, keine "vibrant" Akzente. Optionen-Cards mit dezenter Border + Hover-Shadow.

## Out of Scope (explicit)

- **Security beyond unguessable UUID** — Aleksa: "erstmal nicht". Token ist UUID v4 mit 2^122 Werten — nicht ratebar. Falls später nötig: zusätzliches Geburtsdatum-Gate.
- **Custom Domain für Edge Function direkt** — Netlify-Redirect reicht.
- **Multi-Language** — Auswahl-Seite ist DE only (wie Email).
- **Mobile-Apps-spezifische Optimierungen** — responsive HTML reicht.
- **Vertriebler-Notification, wenn Kunde wählt** — nicht in V1; ggf. später als Webhook.

## Acceptance Criteria

- [ ] Migration läuft auf prod Supabase, alle existierenden Folders haben einen `payment_token`
- [ ] `payment-portal` Edge Function returned brand-konformes HTML für gültigen Token
- [ ] `payment-portal` returned "schon bezahlt"-Seite, wenn `payment_status === 'paid'`
- [ ] Klick auf Einmalzahlung-Karte erzeugt Stripe One-Time-Session und redirected
- [ ] Klick auf Raten-Karte erzeugt Stripe Subscription-Session mit korrekter Rate und redirected
- [ ] Dashboard "Angebot senden" funktioniert ohne Zahlart-Auswahl
- [ ] Email enthält Portal-Link, Button-Text "Ihr Angebot ansehen"
- [ ] Netlify-Redirect funktioniert: `tax.clairmont-advisory.com/pay?t=...` → Portal
- [ ] End-to-End-Test: Prognose erstellen → Mail an info@aleksa.ai → Klick → Auswahl → Stripe → Webhook → `payment_status: paid`

## Build Plan (steps for execution)

| # | Step | File(s) | Acceptance |
|---|---|---|---|
| 1 | Migration `payment_token` | `supabase/migrations/20260514120000_payment_token.sql` | `select count(*) from folders where payment_token is null` → 0 |
| 2 | Edge Function `payment-portal` (skeleton, returns HTML for valid token) | `supabase/functions/payment-portal/index.ts` | curl mit `?t=<existing-token>` returned HTML status 200 |
| 3 | Auswahl-Logic + Brand | dito | Visual review, 1k €/3k €/5k € Erstattungs-Tests zeigen 2/6/9 Raten |
| 4 | "Schon bezahlt"-Variante | dito | Token mit `payment_status: paid` → andere Seite |
| 5 | `create-payment-link` Refactor auf Token-Input | `supabase/functions/create-payment-link/index.ts` | curl-Test mit Token + `installmentCount: 3` → Stripe-Subscription URL |
| 6 | Auswahl-Seite-JS verkabelt mit `create-payment-link` | `payment-portal/index.ts` | Klick → Redirect zu Stripe-Checkout |
| 7 | `OrdnerView.handleSendOffer` Refactor (kein Stripe-Call mehr) | `src/components/dashboard/OrdnerView.tsx` | "Angebot senden" → öffnet EmailDialog mit Portal-URL |
| 8 | `PrognoseDialog` vereinfachen (Zahlart raus) | `src/components/dashboard/PrognoseDialog.tsx` | Dialog hat nur noch Erstattungs-Input |
| 9 | `EmailDialog` Prompt neutralisieren | `src/components/dashboard/EmailDialog.tsx` | KI-generierter Text erwähnt Wahlmöglichkeit |
| 10 | `send-email` Button-Text anpassen | `supabase/functions/send-email/index.ts` | Test-Mail an info@aleksa.ai zeigt "Ihr Angebot ansehen" |
| 11 | `netlify.toml` Redirect in `clairmont-website` | `clairmont-website/netlify.toml` | nach Deploy: `tax.clairmont-advisory.com/pay?t=...` lädt Portal |
| 12 | End-to-End-Smoke-Test | — | siehe Acceptance-Liste |

## Notes

- Netlify-Deploy von `clairmont-website` triggert beim Push automatisch.
- Edge-Function-Deploy via `npx supabase functions deploy <name> --no-verify-jwt --project-ref oxsvxdnoyhwdfklvfwbf`.
- Bestehende `payment_link_url`-Spalte bleibt — wird ab jetzt erst nach Kunden-Klick gefüllt (= optional Audit-Spur welche Stripe-Session der Kunde gewählt hat).
- Bestehende Stripe-Webhooks für `payment_status` (paid/failed) brauchen keine Änderung — Stripe Metadata `folder_id` kommt weiterhin mit.
