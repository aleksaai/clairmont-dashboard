
# Plan: Korrektur der 4.500€-Regel für individuelle Beratung

## Zusammenfassung

Die Schwelle für "Individuelle Beratung erforderlich" muss korrigiert werden. Aktuell wird diese ausgelöst, wenn die **Kundenerstattung** 4.500€ erreicht. Die korrekte Logik ist: Individuelle Beratung wird ausgelöst, wenn die **interne Gebühr** (30% der Erstattung) 4.500€ erreicht.

## Auswirkung der Änderung

| Szenario | Aktuell | Neu (korrigiert) |
|----------|---------|------------------|
| Erstattung 4.500€ → Gebühr 1.350€ | Individuelle Beratung | Bis zu 9 Raten möglich |
| Erstattung 10.000€ → Gebühr 3.000€ | Individuelle Beratung | Bis zu 9 Raten möglich |
| Erstattung 15.000€ → Gebühr 4.500€ | Individuelle Beratung | Individuelle Beratung |

## Änderungen

### Datei: `src/components/dashboard/PrognoseDialog.tsx`

1. **Funktion `getMaxInstallments` anpassen**
   - Aktuelle Logik basiert auf dem Erstattungsbetrag
   - Neue Logik basiert auf der Gebühr (30% der Erstattung)
   - Schwellenwerte entsprechend anpassen:
     - Gebühr >= 4.500€ (= Erstattung >= 15.000€) → Individuelle Beratung
     - Gebühr >= 900€ (= Erstattung >= 3.000€) → Bis zu 9 Raten
     - Gebühr >= 300€ (= Erstattung >= 1.000€) → Bis zu 6 Raten
     - Gebühr < 300€ (= Erstattung < 1.000€) → Bis zu 2 Raten

2. **Funktion `requiresIndividualConsultation` anpassen**
   - Von `amount >= 4500` zu `amount * 0.30 >= 4500` (oder `amount >= 15000`)

3. **Hinweistexte aktualisieren**
   - Die Erklärungstexte unter dem Dropdown anpassen, um die neuen Schwellenwerte zu reflektieren

---

## Technische Details

### Aktuelle Funktionen (zu ändern):

```typescript
// AKTUELL - basiert auf Erstattungsbetrag
const getMaxInstallments = (amount: number): number => {
  if (amount >= 4500) return 0;      // Individuelle Beratung
  else if (amount >= 3000) return 9;  // Bis zu 9 Raten
  else if (amount >= 1000) return 6;  // Bis zu 6 Raten
  else return 2;                       // Bis zu 2 Raten
};

const requiresIndividualConsultation = (amount: number): boolean => 
  amount >= 4500;
```

### Neue Funktionen (nach Korrektur):

```typescript
// NEU - basiert auf Gebühr (30% der Erstattung)
const getMaxInstallments = (feeAmount: number): number => {
  if (feeAmount >= 4500) return 0;      // Individuelle Beratung (Erstattung >= 15.000€)
  else if (feeAmount >= 900) return 9;  // Bis zu 9 Raten (Erstattung >= 3.000€)
  else if (feeAmount >= 300) return 6;  // Bis zu 6 Raten (Erstattung >= 1.000€)
  else return 2;                         // Bis zu 2 Raten
};

const requiresIndividualConsultation = (feeAmount: number): boolean => 
  feeAmount >= 4500;
```

### Angepasste Hinweistexte:

| Gebührenbereich | Erstattungsbereich | Hinweistext |
|-----------------|-------------------|-------------|
| < 300€ | < 1.000€ | "Bis 1.000 €: Sofortzahlung oder max. 2 Raten" |
| 300€ - 899€ | 1.000€ - 2.999€ | "1.000 € – 3.000 €: Bis zu 6 Raten möglich" |
| 900€ - 4.499€ | 3.000€ - 14.999€ | "3.000 € – 15.000 €: Bis zu 9 Raten möglich" |
| >= 4.500€ | >= 15.000€ | Warnung: Individuelle Beratung erforderlich |

### Angepasster Warnungstext:

```text
"Bei einer Gebühr ab 4.500 € (Erstattung ab 15.000 €) ist eine 
individuelle Zahlungsvereinbarung notwendig."
```
