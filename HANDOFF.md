# HANDOFF — clairmont-dashboard

**Letzte Aktualisierung:** 2026-04-24 (Marcus, Post-Go-Live-Support + Forgot-Password)
**Status:** 🟢 **LIVE + laufender Support**

## Wo das Projekt steht

Migration von Lovable auf eigene Infrastruktur an einem Tag durchgezogen (2026-04-20). Alles läuft produktiv:

- **Deploy:** Netlify (auto-deploy auf Push zu `main`)
- **Supabase:** `ufnxliieaejdvxcanqux` (Clairmont Advisory) — 8 Tabellen, 4 Storage-Buckets, 11 Edge Functions
- **Stripe:** Live-Webhook umgestellt + durch echte Zahlung validiert
- **Auth:** 26 User (3 admins, 2 sachbearbeiter, 21 vertriebler), alle mit preservierten UUIDs; Passwörter wurden resettet, User müssen via Reset-Flow neu setzen
- **Daten:** 144 Folders (davon 9 aktive Anzahlung-erhalten-Fälle), 522 Documents, 776 Storage-Files, 3 Messages, 1 Knowledge-Base-Eintrag

## Stack

- Vite + React 18 + TS + Tailwind + shadcn/ui + Radix + React-Hook-Form + Zod + TanStack Query + Recharts
- Supabase JS Client (Auth + Storage + Edge Functions)
- Stripe Edge-Function-seitig (Checkout + Subscriptions mit `cancel_at` nach N Monaten)
- Resend für Emails (`noreply@tax.clairmont-advisory.com`)
- OpenAI GPT-4o-mini für `generate-email` (deutsche Kunden-Emails mit Knowledge-Base-Context)

## Lokal starten

```bash
cd ~/Desktop/Projects/clairmont-dashboard
npm install    # wenn node_modules fehlt
npm run dev    # Vite auf http://localhost:8080
```

`.env` ist aktuell noch committed ins Repo (Lovable-Pattern). In einem späteren Cleanup: `.env` in `.gitignore`, `.env.example` committen. Aktueller Anon-Key ist public und unkritisch.

## Edge Functions (alle live auf Clairmont Advisory)

| Function | Purpose | Secrets |
|---|---|---|
| `form-webhook` | Lead-Empfang von Website (Bearer `Clairmont_2025`) | `FORM_WEBHOOK_SECRET` |
| `credit-webhook` | Kredit-Lead-Empfang | `CREDIT_WEBHOOK_SECRET` |
| `insurance-webhook` | Versicherungs-Lead-Empfang | `INSURANCE_WEBHOOK_SECRET` |
| `create-payment-link` | Stripe Checkout-Session (one-time oder Subscription) | `STRIPE_SECRET_KEY` |
| `stripe-webhook` | Stripe-Event-Handler (checkout/invoice.paid/failed/subscription.deleted) | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| `send-email` | Generic Email | `RESEND_API_KEY` |
| `generate-email` | KI-generierte deutsche Kunden-Email (OpenAI) | `OPENAI_API_KEY`, `RESEND_API_KEY` |
| `payment-reminders` | Cron für 3-Tage-vor-Rate-Erinnerung | `STRIPE_SECRET_KEY`, `RESEND_API_KEY` |
| `notify-vertriebler` | Email an Partnercode-Vertriebler bei neuem Lead | `RESEND_API_KEY` |
| `invite-user` | Admin-only User-Einladung | `RESEND_API_KEY` |
| `delete-user` | Admin-only User-Löschung | — |

## Post-Go-Live Änderungen (2026-04-22 bis 2026-04-24)

| Datum | Thema | Was geändert |
|---|---|---|
| 2026-04-22 | Admin-Invite-User 401 | `invite-user` + `delete-user` redeployed mit `verify_jwt: false` (ES256-Bug, siehe claude-team knowledge.md §18) + `apikey`-Header in `TeamView.tsx` |
| 2026-04-24 | Provisionsrechner-Zahlen falsch | 3 Fixes: (a) `normalizeCode()` Helper in `ProvisionsrechnerView.tsx` (strip `*`, trim, upper) für Partner-Code-Varianten wie `*ALPHA*`/`Alpha `; (b) DB-Reparatur: 49 `updated_at` Werte aus Lovable-CSV via Bulk-UPDATE wiederhergestellt (Trigger disable+enable); (c) Delta 1.614 € in Apr = 1 Folder (Maximilian Charl) steht als `prognose_erstellt` statt `bezahlt` — Aleksas Business-Entscheid |
| 2026-04-24 | Self-Service Passwort-Reset | `Auth.tsx` um Inline-"Passwort vergessen?"-Mode erweitert, `useAuth.ts` um `resetPassword()` Helper. Kein Backend-Change — nutzt bestehenden `/reset-password` Flow |

**Offenes Thema:** Provisions-Seite filtert nach `updated_at` — volatiles Feld, wird bei jedem Status-Wechsel/Notiz-Edit überschrieben. Langfrist-Lösung: dediziertes `paid_at` Feld, gesetzt vom Stripe-Webhook bei Status → `bezahlt`. Roadmap, nicht akut.

## Optional noch offen

1. **Lovable archivieren** — wenn 24-48h stabil gelaufen ist: Lovable-Projekt `ixefmjnjjwntwibkytis` offline, Abo künigen. **⚠ Erst nach Maximilian-Charl-Klärung** (Lovables Snapshot hatte den Folder als `bezahlt` + 5.380 €, unser DB hat ihn als `prognose_erstellt` + NULL)
2. **`.env`-Cleanup** — committed File raus, `.env.example` als Template
3. **`lovable-tagger`** in `package.json` devDeps + `.lovable/` Folder entfernen (kosmetisch)
4. **Supabase Auth URL-Config** — Site URL + Redirect URLs auf Prod-Domain setzen (nicht nur localhost), damit Password-Reset-Mails korrekt funktionieren
5. **DSGVO-Audit** — aktuell gehen Tax-Daten als Email-Inhalte raus → eventuell Signed-Link-Pattern
6. **`paid_at`-Feld** in `folders` einführen (siehe "Offenes Thema" oben)

## Kontext-Switch für frische Claude-Code-Session

1. Lies `CLAUDE.md` (auto-geladen)
2. Lies `SPEC.md` für historischen Migrations-Kontext (alle Phasen mittlerweile erfüllt)
3. Lies diesen HANDOFF für aktuellen Live-State
4. Für Marcus-Mode: nach `~/Desktop/claude-team/` wechseln + `/marcus` tippen. Aktuelle Projektkarte: `ai-team/projects/clairmont/SUMMARY.md`. Live-Status: `ai-team/status/STATUS.md`.

## Migrations-Artefakte

- `src/pages/MigrationExport.tsx` — Admin-Only-Export-Tool das ich gebaut habe um Daten aus Lovable rauszuziehen ohne Service-Role-Key. Kann drin bleiben als Backup-Export-Pfad, oder Admin kann's entfernen.
- `migration/import.mjs` — Node-Script das den Export-JSON importiert. Wurde einmalig 2026-04-20 ausgeführt. Darf weg wenn aufgeräumt wird.
