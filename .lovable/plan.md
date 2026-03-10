

# Plan: Problemfälle-Bereich im Drive

## Zusammenfassung

Wir fügen einen vierten Kategoriebereich "Problemfälle" im Drive hinzu, der:
- Neben Steuerfälle, Kreditfälle und Baufinanzierungsfälle erscheint
- Für **alle Benutzer sichtbar** ist (unabhängig vom Partner-Code)
- Von **allen Mitarbeitern** (inkl. Vertriebler) erstellt werden kann
- Eigene Status-Stufen hat: **Offen** und **Erledigt**

## Visuelle Darstellung

```text
┌─────────────────────────────────────────────────────────────────────┐
│                          Mein Drive                                  │
├─────────────────┬─────────────────┬─────────────────┬───────────────┤
│   Steuerfälle   │   Kreditfälle   │  Baufinanzierung│  PROBLEMFÄLLE │
│      (blau)     │     (gelb)      │     (türkis)    │     (rot)     │
│    12 Ordner    │    5 Ordner     │     3 Ordner    │   4 Ordner    │
└─────────────────┴─────────────────┴─────────────────┴───────────────┘
```

## Änderungen

### 1. Datenbank: Neuer Produkttyp

**Migration: Enum erweitern**

Der `product_type` Enum wird um `problemfall` erweitert:

```sql
ALTER TYPE product_type ADD VALUE 'problemfall';
```

### 2. Datenbank: RLS-Policy für Sichtbarkeit

**Neue RLS-Policy für Problemfälle**

Problemfälle sollen für alle authentifizierten Benutzer sichtbar sein (ohne Partner-Code-Einschränkung):

```sql
CREATE POLICY "All users can view problem cases"
ON public.folders
FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND product = 'problemfall'
);

CREATE POLICY "All users can create problem cases"
ON public.folders
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND product = 'problemfall'
);
```

### 3. Frontend: OrdnerView.tsx anpassen

**Datei:** `src/components/dashboard/OrdnerView.tsx`

#### 3.1 Neuer Produkttyp hinzufügen

```typescript
type ProductType = 'steuern' | 'kredit' | 'versicherung' | 'problemfall';

const allProducts: ProductType[] = ['steuern', 'versicherung', 'kredit', 'problemfall'];
```

#### 3.2 Produktkonfiguration erweitern

```typescript
const productConfig: Record<ProductType, { label: string; color: string; bgColor: string }> = {
  // ... bestehende Einträge ...
  problemfall: { 
    label: 'Problemfälle', 
    color: 'text-red-400',
    bgColor: 'bg-red-500/20 border-red-500/30'
  },
};
```

#### 3.3 Status-Optionen für Problemfälle

```typescript
const productStatuses: Record<ProductType, CaseStatus[]> = {
  // ... bestehende Einträge ...
  problemfall: ['neu', 'abgeschlossen'], // Offen & Erledigt
};

const statusLabels: Record<CaseStatus, string> = {
  // ... bestehende Einträge ...
  // 'neu' wird zu 'Offen' umgelabelt für Problemfälle (kontextabhängig)
};
```

#### 3.4 Kontextabhängige Labels

Für Problemfälle zeigen wir "Offen" statt "Neu" und "Erledigt" statt "Abgeschlossen":

```typescript
const getStatusLabel = (status: CaseStatus, product: ProductType) => {
  if (product === 'problemfall') {
    if (status === 'neu') return 'Offen';
    if (status === 'abgeschlossen') return 'Erledigt';
  }
  return statusLabels[status];
};
```

### 4. Frontend: Ordner-Erstellung anpassen

Die Ordner-Erstellung für Problemfälle:
- Benötigt nur **Kundenname** (kein E-Mail erforderlich)
- Partner-Code wird automatisch vom erstellenden Benutzer übernommen (für Tracking)
- Status startet bei "neu" (= Offen)

### 5. Supabase Types aktualisieren

Die TypeScript-Types werden automatisch nach der Migration aktualisiert und enthalten dann `'problemfall'` als gültigen Wert für `product_type`.

---

## Sicherheits-Konzept

| Rolle | Problemfälle sehen | Problemfälle erstellen | Problemfälle löschen |
|-------|-------------------|----------------------|---------------------|
| Admin | Alle | Ja | Ja |
| Sachbearbeiter | Alle | Ja | Nein |
| Vertriebler | Alle | Ja | Nein |

**Wichtig:** Im Gegensatz zu normalen Ordnern sind Problemfälle für **alle sichtbar**, damit das gesamte Team helfen kann.

---

## Benutzeroberfläche

### Neuer Ordner erstellen (Problemfall)

| Feld | Pflicht | Beschreibung |
|------|---------|--------------|
| Kundenname | Ja | Name des Problemfalls (z.B. "Max Mustermann") |
| E-Mail | Nein | Optional für Kommunikation |
| Partner-Code | Automatisch | Wird vom System übernommen |

### Status-Anzeige

```text
Problemfälle
├── Offen (3 Kundenordner)
│   ├── Max Mustermann
│   ├── Erika Musterfrau
│   └── Hans Beispiel
└── Erledigt (1 Kundenordner)
    └── Peter Problem (gelöst)
```

---

## Zusammenfassung der Änderungen

| Datei | Änderung |
|-------|----------|
| Neue Migration | Enum erweitern + RLS-Policies |
| `src/components/dashboard/OrdnerView.tsx` | Produkttyp + Konfiguration + Status-Labels |
| `src/integrations/supabase/types.ts` | Wird automatisch aktualisiert |

