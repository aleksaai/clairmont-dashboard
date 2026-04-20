# clairmont-dashboard — Clairmont Advisory internes Admin-Tool

> Claude Code lädt diese Datei automatisch als Projekt-Kontext beim Starten im Projekt-Root.

## Was ist das?

Internes Management-Tool für Clairmont Advisory — Vertriebler + Sachbearbeiter + Admin bearbeiten hier Leads, die von der öffentlichen Website (Sibling-Repo: `aleksaai/clairmont-website`) reinkommen. Kanban-Style: Leads durchlaufen Stages von `anfrage_eingegangen` bis `bezahlt`, dazwischen Sachbearbeiter-Review, Prognose-Berechnung, Stripe-Checkout-Versand (One-time oder Ratenzahlung), Ratenzahlungs-Tracking.

## Aktueller Stand (2026-04-20)

🟡 **In Lovable-Migration.** Der Repo wurde frisch von Lovable gepullt. Sibling-Website wird gleichzeitig migriert. Ziel: raus aus Lovable, rein in eigenes Supabase-Projekt "Clairmont Advisory" + Netlify-Deploy. Vollständiger 7-Phasen-Plan in `SPEC.md` + laufender Stand in `HANDOFF.md`.

**Kritisch:** 9 aktive Stripe-Subscriptions → UUID-preserving Data-Migration Pflicht. Cutover-Phase ist atomar (nicht unterbrechbar).

## Stack

- **Vite 5** + **React 18** + **TypeScript**
- **Tailwind CSS 3** + **shadcn/ui** (komplettes Radix-Set)
- **React-Hook-Form + Zod** — Form-Validierung
- **React-Router v6**
- **TanStack Query** — Server-State
- **Recharts** — Charts im Dashboard
- **@supabase/supabase-js** — Backend-Client
- **Supabase Auth** — mit Rollen (admin / sachbearbeiter / vertriebler)

## Run locally

```bash
pnpm install   # oder: npm install
pnpm dev       # Startet Vite dev-server auf port 5173 (default)
```

Login via Supabase Auth — nach dem Signup kriegst du automatisch die Rolle `vertriebler` (via Trigger `handle_new_user`).

## Env-Variablen

Aktuell (Lovable-Zeit):
- `VITE_SUPABASE_URL` — `https://ixefmjnjjwntwibkytis.supabase.co` (Lovable-Supabase, wird in Phase 5 umgestellt)
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Anon Key
- `VITE_SUPABASE_PROJECT_ID` — `ixefmjnjjwntwibkytis`

Nach Phase 5 zeigt das alles auf das neue **Clairmont Advisory** Supabase-Projekt.

## Supabase-Schema (Lovable-Instanz, zu migrieren)

### 8 Tabellen

1. **`profiles`** — linked to `auth.users`
2. **`user_roles`** — enum (admin/sachbearbeiter/vertriebler), default: vertriebler (via trigger)
3. **`partner_codes`** — pro Vertriebler ein eindeutiger Code
4. **`partner_provision_configs`** — Provisionssätze je Partnercode
5. **`folders`** — ⭐ Haupt-Entität (Lead/Case). Felder: `customer_name`, `customer_email`, `product`, `status`, `partner_code`, `prognose_amount`, `payment_link_url`, `payment_status`, `installment_count`, `installments_paid`, `installment_fee`, `next_payment_date`, `assigned_to`, `created_by`
6. **`documents`** — pro Folder (FK: `folder_id`, `uploaded_by`)
7. **`knowledge_base`** — Produkt-Dokumentationen
8. **`messages`** — Chat zwischen Usern

### 3 Enums

- `app_role`: admin, sachbearbeiter, vertriebler
- `case_status`: anfrage_eingegangen, prognose_erstellt, anzahlung_erhalten, bezahlt, rueckstand, u.a.
- `product_type`: steuern, kredit, versicherung, u.a.

### 4 DB-Funktionen

`get_user_role`, `has_role`, `handle_new_user` (auto-create profile + default role), `update_updated_at_column`

### 4 Storage-Buckets

`avatars`, `documents` (pro folder), `knowledge-base`, `chat-attachments`

### RLS

Auf allen 8 Tabellen. Policies nutzen `has_role()` für Rollen-Gating.

## Edge Functions (11)

| Function | Purpose |
|---|---|
| `form-webhook` | Empfängt Leads von der Website (Bearer `Clairmont_2025`). Erstellt folder + uploaded PDF/Files in Storage. Triggert `notify-vertriebler` bei Partnercode. |
| `create-payment-link` | Erstellt Stripe Checkout Session — entweder one-time oder Subscription für Raten. Fee = 30% der Prognose + Installment-Gebühr. |
| `stripe-webhook` | Handles `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`. Updated folder.status + installments_paid. Schickt Resend-Mails an Team + Kunde. |
| `credit-webhook` | Separater Lead-Fluss für Kredit-Produkt |
| `insurance-webhook` | Separater Lead-Fluss für Versicherungen |
| `send-email` / `generate-email` | Generische E-Mail-Flows (vermutlich mit AI-Generierung) |
| `payment-reminders` | Cron-basiertes Erinnerungssystem für ausstehende Raten |
| `notify-vertriebler` | Push-Benachrichtigung bei neuem Lead mit Partnercode |
| `invite-user` | Admin-Only: neuen User per Email einladen |
| `delete-user` | Admin-Only: User komplett löschen |

## Payment-Flow (aus `stripe-webhook` + `create-payment-link`)

1. Sachbearbeiter erfasst Prognose-Betrag in `folders`
2. `create-payment-link` berechnet Fee (30% + installment-Fee), erstellt Stripe-Session
3. Sachbearbeiter schickt Link an Kunden
4. Kunde zahlt:
   - **1 Rate:** Stripe one-time → `checkout.session.completed` → `status='bezahlt'`
   - **>1 Rate:** Stripe Subscription mit monthly recurring, `cancel_at` nach N Monaten → `status='anzahlung_erhalten'` → `installments_paid=1`
5. Monatliche Raten: `invoice.paid` Events zählen `installments_paid` hoch. Bei letztem: `status='bezahlt'`, `cancel_at` triggert automatische Kündigung.
6. Failed Payment: `invoice.payment_failed` → `status='rueckstand'` + Reminder-Email an Kunde

## Secrets (in Supabase)

`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `FORM_WEBHOOK_SECRET` (= `Clairmont_2025`), plus Supabase-interne.

## Deploy

Aktuell: Lovable-managed. Ziel: **Netlify** (siehe SPEC.md Phase 6).

## Wer arbeitet hier?

- **Aleksa** (Owner, GitHub: aleksaai)
- **Marcus** (AI Engineer via `/marcus` im claude-team) — Migrations-Lead

## Sibling-Repos

- `~/Desktop/Projects/clairmont-website/` — die öffentliche Website
- `~/Desktop/claude-team/` — AI-Team-Workspace

## Lovable-Artefakte die in Phase 6 raus müssen

- `.lovable/` Folder
- `lovable-tagger` in `package.json` devDependencies
- `.env` committed ins Repo → muss in `.gitignore`
- README-Lovable-Boilerplate
