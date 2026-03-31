

# Plan: Vertriebler-Benachrichtigung bei manuellem Ordner-Erstellen & Partnercode-Zuweisung

## Problem

Vertriebler werden nur benachrichtigt, wenn ein Kunde über die externen Webhooks (Formular) reinkommt. Zwei Fälle fehlen:

1. Admin erstellt manuell einen Ordner mit Partnercode im Dashboard
2. Admin weist nachträglich einen Partnercode zu einem bestehenden Ordner zu

## Lösung

### Datei: `src/components/dashboard/OrdnerView.tsx`

**1. Nach `createFolder`** (ca. Zeile 270): Nach erfolgreichem Insert, wenn `partnerCode` gesetzt ist, `notify-vertriebler` mit `type: 'new_customer'` aufrufen.

**2. Nach `savePartnerCode`** (ca. Zeile 227): Nach erfolgreichem Update, wenn der neue Partnercode nicht leer ist, `notify-vertriebler` mit `type: 'new_customer'` aufrufen -- damit der neu zugewiesene Vertriebler informiert wird.

### Keine weiteren Änderungen nötig

Die `notify-vertriebler` Edge Function unterstützt bereits den `new_customer`-Typ mit Partnercode-Lookup. Es muss nur im Frontend an den zwei Stellen der Aufruf ergänzt werden.

