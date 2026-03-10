

# Plan: Umsatz-Berechnung korrigieren (30% Gebühr statt volle Steuernachzahlung)

## Problem

Du hast recht. Aktuell wird in der Provisionsübersicht als "Umsatz" der volle `prognose_amount` verwendet -- das ist die geschätzte Steuernachzahlung des Kunden. Euer tatsächlicher Umsatz ist aber nur die **30% Beratungsgebühr** davon.

**Beispiel:**
- Steuernachzahlung (prognose_amount): 10.000 €
- Aktuell angezeigt als Umsatz: 10.000 € (falsch)
- Richtig wäre: 3.000 € (30% Gebühr = euer Umsatz)

Die Vertriebler-Provisionen werden dann weiterhin auf Basis dieses 30%-Umsatzes berechnet.

## Änderungen

### Datei: `src/components/dashboard/ProvisionsrechnerView.tsx`

1. **`totalAmount` auf 30% umstellen** -- Überall wo `prognose_amount` als Umsatz summiert wird, stattdessen `prognose_amount * 0.3` verwenden:

```typescript
const amount = folder.prognose_amount || 0;
const fee = amount * 0.3; // 30% Beratungsgebühr = unser Umsatz
```

2. **Umsatz-Karte oben** zeigt dann den korrekten Gebühren-Umsatz (30%)

3. **Kundendetails in der Partnerliste** -- Dort ebenfalls die Gebühr (30%) statt die volle Nachzahlung anzeigen, damit es konsistent ist. Optional kann die ursprüngliche Steuernachzahlung als Zusatzinfo klein angezeigt werden.

4. **Label anpassen** -- "Umsatz" bleibt, zeigt aber nun den korrekten Wert. Optional kann ein Tooltip oder Untertitel "30% Beratungsgebühr" hinzugefügt werden.

### Keine Datenbankänderungen nötig

Die Berechnung passiert rein im Frontend.

