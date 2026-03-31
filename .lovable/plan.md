

# Plan: Monatliche Auszahlungsübersicht für Admins

## Zusammenfassung

Eine neue "Auszahlungsliste" Card wird für Admins auf der Provisionsseite hinzugefügt. Sie zeigt eine kompakte, abhakbare Liste aller Personen, an die am Monatsende Geld ausgezahlt werden muss -- sowohl Vertriebler (Provisionen) als auch Sachbearbeiter (Gebühren).

## Konzept

```text
┌─────────────────────────────────────────────────┐
│  💶 Auszahlungen März 2026                      │
│                                                 │
│  Gesamt auszuzahlen: 4.230,00 €                │
│  ├── Provisionen: 2.750,00 €                   │
│  └── Sachbearbeiter: 1.480,00 €                │
│                                                 │
│  ☐  ALEKSA — Provision — 1.000,00 €            │
│  ☐  AH-UZ  — Provision — 1.500,00 €            │
│  ☐  MU-SY  — Provision —   250,00 €            │
│  ☐  Sachbearbeiter (ALEKSA, 4 Fälle) — 520,00 €│
│  ☐  Sachbearbeiter (AH-UZ, 3 Fälle) — 390,00 € │
│  ☐  Sachbearbeiter (MU-SY, 2 Fälle) — 260,00 € │
│  ☐  Sachbearbeiter (direkt, 1 Fall) — 130,00 € │
│                                                 │
│  ✅ 0/7 erledigt                                │
└─────────────────────────────────────────────────┘
```

Die Checkboxen sind rein lokal (State) -- sie dienen nur dazu, während der Auszahlung den Überblick zu behalten, welche Posten schon überwiesen wurden. Kein Datenbank-Tracking nötig.

## Technische Umsetzung

### Datei: `src/components/dashboard/ProvisionsrechnerView.tsx`

1. **Neue Card** zwischen dem Chart und "Provisionen nach Partnercode", nur für Admins sichtbar.

2. **Daten** werden aus den bereits vorhandenen `provisionsByPartner` und `totals` berechnet -- keine neuen Queries nötig. Die Liste wird generiert aus:
   - Je Partnercode: eine Zeile mit dem Provisionsbetrag
   - Je Partnercode: eine Zeile mit der Sachbearbeiter-Gebühr (Anzahl Fälle x Gebühr pro Fall)
   - Ordner ohne Partnercode: Sachbearbeiter-Gebühr separat

3. **Checkboxen** mit lokalem `useState<Set<string>>` -- beim Abhaken wird die Zeile visuell durchgestrichen und der Fortschritt aktualisiert.

4. **Sortierung**: Höchste Beträge zuerst, gruppiert nach Typ (Provisionen, dann Sachbearbeiter).

### Keine Datenbankänderungen nötig

Alles basiert auf bereits vorhandenen Daten.

