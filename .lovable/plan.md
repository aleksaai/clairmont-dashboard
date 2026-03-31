

# Plan: Provisionsberechnung zurücksetzen auf 30%-Basis

## Problem

Die letzte Änderung hat die Provisionsbasis von 30% (Beratungsgebühr) auf 100% (volle Erstattung) umgestellt. Die Provisionssätze in der Datenbank waren aber offensichtlich bereits auf die 30%-Basis kalibriert, weshalb die Zahlen jetzt ~3,33× zu hoch sind.

## Lösung

Die Provisionsberechnung in beiden Dateien zurück auf die 30%-Basis setzen:

### Datei 1: `src/components/dashboard/ProvisionsrechnerView.tsx`

**Zeile 281** ändern:
```typescript
// Aktuell (falsch):
const provision = calculateProvision(code, rawAmount);

// Korrektur:
const provision = calculateProvision(code, amount); // amount = rawAmount * 0.3
```

### Datei 2: `src/components/dashboard/ProvisionChart.tsx`

**Zeilen 69-75** ändern: `fullAmount` durch `amount` ersetzen, sodass die Provision wieder auf Basis der 30%-Gebühr berechnet wird.

### Keine Datenbankänderungen nötig

Reine Frontend-Korrektur in zwei Dateien.

