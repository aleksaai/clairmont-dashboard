# SPEC — clairmont-dashboard (Lovable-Migration)

**Gestartet:** 2026-04-20
**Owner (technisch):** Marcus
**Owner (Business):** Aleksa für Kunde Clairmont Advisory

## Ziel dieser SPEC

**Migration** von Lovable auf eigenes Hosting. Keine neuen Features. 1:1-Umzug inklusive aller 9 aktiven Stripe-Subscriptions mit UUID-Preservation.

## User / Stakeholder

| Rolle | Was sie tun |
|---|---|
| **admin** (Clairmont-Leitung) | User verwalten (invite/delete), alle Folders sehen, Provisionssätze setzen |
| **sachbearbeiter** | Lead-Review, Prognose-Berechnung, Stripe-Link verschicken, Dokumente prüfen, Chat mit Kunden/Team |
| **vertriebler** | Eigene Leads sehen (via Partnercode), Provisions-Übersicht |
| **Aleksa** | Betrieb sicherstellen, Migration ohne Datenverlust, Stripe-Einnahmen nicht unterbrechen |

## Core function

Ein Kanban-artiges Admin-Tool für Clairmonts Lead-Management. Jeder Lead = ein `folder`. Status-Automatik durch Stripe-Events. Rollen-basiertes Zugriffsmodell.

## Daten-Fluss (aktuell)

**Inbound (von Website):**
1. Website schickt Form-Submission → `form-webhook` (Bearer `Clairmont_2025`)
2. `form-webhook` erstellt neuen `folder` mit `status='anfrage_eingegangen'`, `product='steuern'` (oder andere je nach Source)
3. PDF wird dekodiert und in Storage-Bucket `documents/<folder-id>/` hochgeladen
4. `documents`-Tabelle kriegt Einträge für jede Datei
5. `notify-vertriebler` wird getriggert wenn Lead einen Partnercode hat

**Internal (im Dashboard):**
1. Sachbearbeiter öffnet Folder → sieht Form-Daten + Dokumente
2. Berechnet Prognose-Betrag → speichert in `folders.prognose_amount`
3. Wählt Installment-Count (1 für einmal, 2-N für Raten) → Call an `create-payment-link`
4. `create-payment-link` erstellt Stripe-Session, speichert URL in `folders.payment_link_url`, setzt `payment_status='pending'`
5. Sachbearbeiter kopiert Link, schickt an Kunden (manuell oder via `send-email`)

**Payment (Stripe → zurück):**
1. Kunde zahlt auf Stripe-Seite
2. Stripe schickt Event an `stripe-webhook`
3. Je nach Event-Typ + Mode: `folders.status` wird auf `anzahlung_erhalten` / `bezahlt` / `rueckstand` gesetzt
4. Resend verschickt Bestätigungs-E-Mail an Team (`service@clairmont-advisory.com`) + Kunde

## Externe APIs

- **Supabase** (alles — DB, Auth, Storage, Edge Functions)
- **Stripe** — Checkout + Subscriptions + Webhooks
- **Resend** (Email)

## Das Schema 1:1 (aus 21 Migrations)

Siehe `CLAUDE.md` für die Tabellen-Übersicht. Die 21 Migrations bauen iterativ das Schema auf (profiles → user_roles → partner_codes → folders → documents → knowledge_base → messages → Indices → RLS-Policies → neue Columns für Ratenzahlung + Payment-Tracking → Final Cleanup).

## Migrations-Plan (7 Phasen)

### Phase 1: Prep & Access
- Aleksa liefert: Lovable-Dashboard-Supabase-Credentials (**Service-Role-Key + DB-Password**), Stripe-Dashboard-Zugang, Resend-API-Key, DNS-Zugang
- Marcus linkt Supabase CLI an Clairmont Advisory

### Phase 2: Schema + Edge Functions auf Clairmont Advisory
```bash
cd ~/Desktop/Projects/clairmont-dashboard/
supabase link --project-ref <CLAIRMONT-ADVISORY-REF>
supabase db push        # Alle 21 Migrations sauber pushen
supabase functions deploy --project-ref <CLAIRMONT-ADVISORY-REF>  # 11 Functions
# Secrets setzen (außer STRIPE_WEBHOOK_SECRET — kommt in Phase 4)
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxx
supabase secrets set RESEND_API_KEY=re_xxx
supabase secrets set FORM_WEBHOOK_SECRET=Clairmont_2025
```
- Verify: Login mit neuem Test-Admin funktioniert, leeres Dashboard wird angezeigt

### Phase 3: Data-Migration (atomar!)
```bash
# 1. Lovable-Dashboard in Maintenance-Mode (oder Traffic pausieren)
# 2. pg_dump von Lovable
pg_dump "postgres://postgres:<LOVABLE-DB-PASSWORD>@db.ixefmjnjjwntwibkytis.supabase.co:5432/postgres" \
  --data-only --disable-triggers --no-owner --no-privileges \
  -t public.profiles -t public.user_roles -t public.partner_codes \
  -t public.partner_provision_configs -t public.folders \
  -t public.documents -t public.knowledge_base -t public.messages \
  > ~/Desktop/Projects/clairmont-dashboard/migration/lovable-dump.sql

# 3. psql import nach Clairmont Advisory
psql "postgres://postgres:<NEW-DB-PASSWORD>@db.<CLAIRMONT-ADVISORY-REF>.supabase.co:5432/postgres" \
  -f ~/Desktop/Projects/clairmont-dashboard/migration/lovable-dump.sql

# 4. Auth-Users migrieren via Supabase Management API
#    (Download alle auth.users aus Lovable, re-create in Clairmont Advisory
#     mit gleicher id, email, password_hash — Script nötig)

# 5. Storage-Buckets rüberziehen (avatars, documents, knowledge-base, chat-attachments)
#    Per Node-Script: list files from old, download, upload to new, preserve paths

# 6. Verify: alle 9 folder.id UUIDs mit aktiver Stripe-Subscription existieren in neuer DB
```

### Phase 4: Stripe-Webhook-Cutover
- In Stripe-Dashboard: Webhook `https://ixefmjnjjwntwibkytis.supabase.co/functions/v1/stripe-webhook` → `https://<CLAIRMONT-ADVISORY-REF>.supabase.co/functions/v1/stripe-webhook`
- Neuen `STRIPE_WEBHOOK_SECRET` abholen
- In Clairmont Advisory setzen: `supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx`
- Test: nächste echte Rate-Abbuchung landet im neuen System (oder Test-Event via Stripe CLI triggern)

### Phase 5: Code-Switch (Frontend)
- `.env` auf neue Supabase-URL + Keys
- Push, Netlify deployed automatisch
- Verify: Login, Dashboard läuft, Daten sichtbar, Stripe-Link-Generierung funktioniert

### Phase 6: Repo-Cleanup + Netlify-Deploy
- `.lovable/` + `lovable-tagger` + `.env` im Repo aufräumen
- Netlify-Site anlegen (falls nicht in Phase 5 schon)
- Custom-Subdomain z.B. `dashboard.clairmont-advisory.com` oder vorhandene URL

### Phase 7: Lovable disconnecten
- Erst wenn Netlify + neue Supabase 48h stabil laufen
- Lovable-Projekt archivieren, Account löschbar

## Kritisch — UUID-Preservation

Die 9 Stripe-Subscriptions haben `metadata.folder_id` = UUID aus `folders.id`. Wenn wir beim `pg_dump → psql` die UUIDs **nicht** preservieren, bricht der gesamte Payment-Tracking:
- `invoice.paid` Events kommen rein mit folder_id X
- Stripe-Webhook sucht folder X in neuer DB → nicht gefunden → fail silently
- Die 9 Kunden zahlen weiter, aber ihre `folders.installments_paid` wird nicht erhöht, `status` bleibt falsch

**Daher:** `pg_dump --data-only` (schema wurde in Phase 2 schon angelegt) + `psql` OHNE UUID-Regeneration. Das `--data-only`-Flag sorgt dafür dass alle UUIDs exakt übernommen werden.

## Akzeptanz

- [ ] Alle 8 Tabellen haben in neuer DB dieselbe Row-Count wie in alter DB
- [ ] Alle 9 `folders.id` UUIDs mit aktiver Stripe-Subscription matchen 1:1
- [ ] Login-Flow funktioniert, Test-Admin sieht Dashboard
- [ ] Login als bestehender User (z.B. Sachbearbeiter) zeigt dessen bisherige Folders
- [ ] `create-payment-link` generiert einen Stripe-Link (mit Test-Folder)
- [ ] `stripe-webhook` (neue URL) empfängt Test-Event und updated folder korrekt
- [ ] Alle 4 Storage-Buckets haben Files
- [ ] Kein `.env` im Repo
- [ ] `lovable-tagger` weg
- [ ] Netlify-Deploy live

## Constraints

- **UUID-Preservation Pflicht** (9 Stripe-Subscriptions)
- **Atomarer Cutover** zwischen Phase 3 und Phase 4 (keine Leads / Zahlungen dazwischen)
- **DSGVO:** echte Kundendaten (Name, Email, IBAN, Tax-Daten) — Migration darf nichts verlieren
- **Low-Traffic-Fenster** für Phase 3-4 bevorzugt (abends / Wochenende)

## Nicht im Scope

- Neue Features
- Design-Refresh
- Stripe-MCP-Integration (kommt in Post-Migration)
- Direkter Website → DB statt Webhook (kommt in Post-Migration)

## Referenzen

- Sibling-Repo: `~/Desktop/Projects/clairmont-website/`
- Master-Projekt-Karte: `~/Desktop/claude-team/ai-team/projects/clairmont/SUMMARY.md`
- Live-Status: `~/Desktop/claude-team/ai-team/status/STATUS.md` (Abschnitt "Marcus — Clairmont")
