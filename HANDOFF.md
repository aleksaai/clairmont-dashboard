# HANDOFF — clairmont-dashboard

**Letzte Aktualisierung:** 2026-04-20 (Marcus)

## Wo wir aktuell stehen

**Phase 0 (Daten-Export) — Tool ist gebaut, wartet auf Aleksa's Ausführung.**

Aleksa's Entscheidung 2026-04-20: KEINE Aktion in Lovable (keine Edge Function da deployen, nichts im Lovable-Chat pasten). Beide Repos wurden von Lovable disconnected. Pg_dump ist unmöglich weil Lovable die Service-Role-Credentials nicht rausrückt. **Neue Strategie:** lokales Admin-Export-Tool im Dashboard-Repo (Route `/migration-export`) — läuft lokal mit Aleksa's Admin-Session, exportiert alle Daten als JSON.

## Was Aleksa jetzt tun muss

```bash
cd ~/Desktop/Projects/clairmont-dashboard
npm run dev     # startet Vite auf http://localhost:8080
```

Dann im Browser:
1. http://localhost:8080 öffnen
2. Als Admin einloggen (die bestehende Admin-Email + Passwort aus dem Lovable-Dashboard)
3. Navigieren zu http://localhost:8080/migration-export
4. "Export starten" klicken — das Tool zieht alle 8 Tabellen + Signed-URLs für alle 4 Storage-Buckets (30 Tage gültig)
5. JSON-Download geht automatisch
6. Datei an Marcus weitergeben (Dateigröße sollte klein sein, wenige MB — weil nur Signed-URLs, keine Base64-Blobs)

## Was schon passiert ist

- Repo von Lovable-synced GitHub gepullt nach `~/Desktop/Projects/clairmont-dashboard/`
- Vollständige Code-Analyse durchgeführt (Marcus, 2026-04-20):
  - 8 Tabellen, 3 Enums, 4 DB-Funktionen, 4 Storage-Buckets dokumentiert
  - 11 Edge Functions analysiert (insbesondere `form-webhook`, `create-payment-link`, `stripe-webhook` wegen Payment-Flow)
  - 9 aktive Stripe-Subscriptions als kritischer Blocker identifiziert → UUID-Preservation notwendig
- `CLAUDE.md` + `SPEC.md` + `HANDOFF.md` (diese Datei) angelegt
- Supabase-Projekt "Clairmont Advisory" von Aleksa frisch angelegt (2026-04-20)
- Ziel-Strategie: **ein Supabase für beide Lovable-Apps**
- Migration-Plan in 7 Phasen finalisiert (siehe SPEC.md)

## Was gerade blockiert

**Aleksa muss das Export-Tool laufen lassen (siehe oben).** Sobald das JSON bei Marcus ist:
- Marcus parst JSON + downloadet Storage-Files via Signed-URLs
- Phase 2 läuft (Schema deployen auf Clairmont Advisory)
- Phase 3 läuft (Import der Daten mit UUID-Preservation)

**Später (für Phase 4+):**
- Stripe-Webhook-Umstellung: muss Clairmont selbst machen (ihr Stripe-Account)
- DNS-Zugang für die Clairmont-Domain: Phase 6 Cutover
- Secrets die Marcus nicht aus dem Export ziehen kann (`RESEND_API_KEY`, `FORM_WEBHOOK_SECRET`, `INSURANCE_WEBHOOK_SECRET`, `CREDIT_WEBHOOK_SECRET`, `LOVABLE_API_KEY`-Ersatz) — Aleksa kennt die aus Lovable-Dashboard → Edge Function Settings

## Was als nächstes kommt (sobald Phase 1 durch)

### Phase 2: Schema + Edge Functions auf Clairmont Advisory

**Konkreter Befehls-Ablauf (Marcus plant):**
```bash
# 1. Link lokaler Supabase-CLI an Clairmont Advisory
cd ~/Desktop/Projects/clairmont-dashboard/
supabase link --project-ref <CLAIRMONT-ADVISORY-REF>

# 2. Alle 21 Migrations pushen
supabase db push

# 3. Alle 11 Edge Functions deployen
supabase functions deploy form-webhook --no-verify-jwt
supabase functions deploy create-payment-link --no-verify-jwt
supabase functions deploy stripe-webhook --no-verify-jwt
# ... (alle 11 Functions)

# 4. Secrets setzen
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxx
supabase secrets set RESEND_API_KEY=re_xxx
supabase secrets set FORM_WEBHOOK_SECRET=Clairmont_2025
# STRIPE_WEBHOOK_SECRET kommt in Phase 4

# 5. Verify: Test-Admin erstellen, Login testen
```

### Phase 3: Data-Migration

Der pg_dump-Befehl steht bereit in SPEC.md → Phase 3. Wird atomar mit Phase 4 ausgeführt.

## Kontext-Switch-Notizen

Wenn du in einer frischen Claude-Code-Session landest:

1. Lies `CLAUDE.md` (sollte auto-geladen sein)
2. Lies `SPEC.md` für den vollen Migrations-Plan
3. Lies diesen HANDOFF für den aktuellen Stand
4. Wenn Marcus-Modus gebraucht: zurück nach `~/Desktop/claude-team/` und `/marcus` tippen
5. Master-Projekt-Karte: `~/Desktop/claude-team/ai-team/projects/clairmont/SUMMARY.md`
6. Live-Status: `~/Desktop/claude-team/ai-team/status/STATUS.md` (Abschnitt "Marcus — Clairmont")

## Bekannte Gotchas

- **9 Stripe-Subscriptions** hängen an `folders.id` UUIDs — UUID-Preservation beim `pg_dump --data-only` Pflicht
- **`.env` im Repo committed** (Lovable-Pattern) — in Phase 6 raus
- **`lovable-tagger` in package.json** — in Phase 6 raus
- **Supabase Auth Users** brauchen separates Migrations-Script (pg_dump vom public-Schema migriert nicht auth.users) — Management API nutzen
- **Storage-Buckets** müssen separat migriert werden (pg_dump macht die Storage-Objects nicht mit)
- **`FORM_WEBHOOK_SECRET` = `Clairmont_2025`** ist im Website-Code hardcoded (`ADDITIONAL_WEBHOOK_TOKEN`). Wenn wir den Secret ändern wollen, muss der Website-Code auch angepasst werden.

## Cutover-Zeitfenster-Planung

Phase 3-4 müssen in einem Rutsch laufen, während keine Leads oder Zahlungen durchgehen. Empfehlung:
- **Samstag Abend / Sonntag Morgen** — niedrigster Traffic
- **Vorher ankündigen** bei Clairmont + Aleksas Team
- **Rollback-Plan:** wenn Phase 4 fehlschlägt, Stripe-Webhook zurück auf Lovable-URL (muss dokumentiert werden)

## Kommunikations-Kanal

- Slash-Command `/marcus` im claude-team Repo für Migrations-Arbeit
- Direkt bei Aleksa für Credentials + Entscheidungen
