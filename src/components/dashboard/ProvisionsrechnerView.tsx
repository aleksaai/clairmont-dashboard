import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calculator, Euro, Users, Building2 } from 'lucide-react';

type PartnerCode = 
  | 'KEIN_CODE'
  | 'ALPHA'
  | 'ALEKSA'
  | 'CA-DC'
  | 'CH-PO'
  | 'MU-SY'
  | 'EN-SA'
  | 'BU-KO'
  | 'AH-EN'
  | 'AH-UZ'
  | 'MÜ-TU'
  | 'ME-KA'
  | 'IS-CA'
  | 'SA-MU'
  | 'LA-KH'
  | 'MU-SI'
  | 'SA-AL'
  | 'ME-CA'
  | 'HA-SA'
  | 'HA-YI'
  | 'AR-GÜ'
  | 'HA-MI';

interface ProvisionConfig {
  type: 'fixed' | 'percentage';
  value: number;
  label: string;
}

const PARTNER_CONFIGS: Record<PartnerCode, ProvisionConfig> = {
  'KEIN_CODE': { type: 'fixed', value: 0, label: 'Kein Code' },
  'ALPHA': { type: 'percentage', value: 30, label: 'ALPHA' },
  'ALEKSA': { type: 'percentage', value: 10, label: 'ALEKSA' },
  'CA-DC': { type: 'percentage', value: 5, label: 'CA-DC' },
  'CH-PO': { type: 'percentage', value: 5, label: 'CH-PO' },
  'MU-SY': { type: 'percentage', value: 5, label: 'MU-SY' },
  'EN-SA': { type: 'fixed', value: 150, label: 'EN-SA' },
  'BU-KO': { type: 'fixed', value: 150, label: 'BU-KO' },
  'AH-EN': { type: 'fixed', value: 150, label: 'AH-EN' },
  'AH-UZ': { type: 'fixed', value: 150, label: 'AH-UZ' },
  'MÜ-TU': { type: 'fixed', value: 150, label: 'MÜ-TU' },
  'ME-KA': { type: 'fixed', value: 150, label: 'ME-KA' },
  'IS-CA': { type: 'percentage', value: 10, label: 'IS-CA' },
  'SA-MU': { type: 'fixed', value: 150, label: 'SA-MU' },
  'LA-KH': { type: 'fixed', value: 150, label: 'LA-KH' },
  'MU-SI': { type: 'fixed', value: 150, label: 'MU-SI' },
  'SA-AL': { type: 'fixed', value: 150, label: 'SA-AL' },
  'ME-CA': { type: 'fixed', value: 150, label: 'ME-CA' },
  'HA-SA': { type: 'percentage', value: 5, label: 'HA-SA' },
  'HA-YI': { type: 'fixed', value: 150, label: 'HA-YI' },
  'AR-GÜ': { type: 'fixed', value: 150, label: 'AR-GÜ' },
  'HA-MI': { type: 'fixed', value: 150, label: 'HA-MI' },
};

const BOOKKEEPER_FEE = 130; // B = Buchhalter bekommt immer 130€

export function ProvisionsrechnerView() {
  const [partnerCode, setPartnerCode] = useState<PartnerCode>('KEIN_CODE');
  const [totalAmount, setTotalAmount] = useState<string>('');
  const [currentYearCount, setCurrentYearCount] = useState<string>('1');
  const [previousYearsCount, setPreviousYearsCount] = useState<string>('0');

  const calculation = useMemo(() => {
    const amount = parseFloat(totalAmount) || 0;
    const currentYears = parseInt(currentYearCount) || 1;
    const previousYears = parseInt(previousYearsCount) || 0;
    const config = PARTNER_CONFIGS[partnerCode];

    let vertrieblerProvision = 0;
    let bookkeeperAmount = BOOKKEEPER_FEE;
    let companyAmount = 0;

    if (partnerCode === 'KEIN_CODE') {
      // Kein Code: 130€ (B), Rest (U)
      vertrieblerProvision = 0;
      bookkeeperAmount = BOOKKEEPER_FEE;
      companyAmount = Math.max(0, amount - bookkeeperAmount);
    } else if (partnerCode === 'ALPHA') {
      // ALPHA: 30% zu U (Unternehmen bekommt 30%, kein B erwähnt - interpretiere als spezieller Fall)
      vertrieblerProvision = amount * 0.30;
      bookkeeperAmount = 0;
      companyAmount = amount - vertrieblerProvision;
    } else if (config.type === 'percentage') {
      // Prozent-basierte Provision: X%(Vertriebler), 130€(B), rest(U)
      vertrieblerProvision = amount * (config.value / 100);
      bookkeeperAmount = BOOKKEEPER_FEE;
      companyAmount = Math.max(0, amount - vertrieblerProvision - bookkeeperAmount);
    } else {
      // Fixe Provision mit Jahr-Logik:
      // Aktuelles Jahr: 150€
      // Vorjahre: je 50€
      // Beispiel: 24(aktuell) + 23,22,21(vorjahre) = 150€ + 3*50€ = 300€
      const currentYearBonus = currentYears > 0 ? 150 : 0;
      const previousYearsBonus = previousYears * 50;
      vertrieblerProvision = currentYearBonus + previousYearsBonus;
      bookkeeperAmount = BOOKKEEPER_FEE;
      companyAmount = Math.max(0, amount - vertrieblerProvision - bookkeeperAmount);
    }

    return {
      vertrieblerProvision,
      bookkeeperAmount,
      companyAmount,
      total: amount,
      isFixedType: config.type === 'fixed' && partnerCode !== 'KEIN_CODE',
    };
  }, [partnerCode, totalAmount, currentYearCount, previousYearsCount]);

  const config = PARTNER_CONFIGS[partnerCode];
  const showYearInputs = config.type === 'fixed' && partnerCode !== 'KEIN_CODE';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Calculator className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold text-foreground">Provisionsrechner</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Eingabe */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Eingaben</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="partner-code">Partnercode</Label>
              <Select value={partnerCode} onValueChange={(v) => setPartnerCode(v as PartnerCode)}>
                <SelectTrigger id="partner-code">
                  <SelectValue placeholder="Partnercode wählen" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PARTNER_CONFIGS).map(([code, cfg]) => (
                    <SelectItem key={code} value={code}>
                      {cfg.label}
                      {cfg.type === 'percentage' && ` (${cfg.value}%)`}
                      {cfg.type === 'fixed' && code !== 'KEIN_CODE' && ' (150€ + Jahre)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="total-amount">Gesamtbetrag (€)</Label>
              <Input
                id="total-amount"
                type="number"
                placeholder="z.B. 1500"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
              />
            </div>

            {showYearInputs && (
              <>
                <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Jahr-basierte Provision:</p>
                  <p>• Aktuelles Jahr: 150€</p>
                  <p>• Jedes Vorjahr: 50€</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="current-years">Aktuelles Jahr</Label>
                    <Select value={currentYearCount} onValueChange={setCurrentYearCount}>
                      <SelectTrigger id="current-years">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Nein</SelectItem>
                        <SelectItem value="1">Ja (150€)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="previous-years">Anzahl Vorjahre</Label>
                    <Select value={previousYearsCount} onValueChange={setPreviousYearsCount}>
                      <SelectTrigger id="previous-years">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                          <SelectItem key={n} value={n.toString()}>
                            {n} {n === 1 ? 'Jahr' : 'Jahre'} ({n * 50}€)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Ergebnis */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Aufteilung</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {/* Vertriebler */}
              <div className="flex items-center justify-between p-4 bg-primary/10 rounded-lg">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">Vertriebler</p>
                    <p className="text-sm text-muted-foreground">
                      {partnerCode === 'KEIN_CODE' 
                        ? 'Kein Partnercode' 
                        : config.type === 'percentage' 
                          ? `${config.value}% Provision`
                          : showYearInputs
                            ? `150€ + ${parseInt(previousYearsCount) || 0}×50€`
                            : 'Keine Provision'}
                    </p>
                  </div>
                </div>
                <p className="text-xl font-bold text-foreground">
                  {calculation.vertrieblerProvision.toFixed(2)} €
                </p>
              </div>

              {/* Buchhalter */}
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Euro className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-foreground">Buchhalter (B)</p>
                    <p className="text-sm text-muted-foreground">Fixbetrag</p>
                  </div>
                </div>
                <p className="text-xl font-bold text-foreground">
                  {calculation.bookkeeperAmount.toFixed(2)} €
                </p>
              </div>

              {/* Unternehmen */}
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-foreground">Unternehmen (U)</p>
                    <p className="text-sm text-muted-foreground">Restbetrag</p>
                  </div>
                </div>
                <p className="text-xl font-bold text-foreground">
                  {calculation.companyAmount.toFixed(2)} €
                </p>
              </div>
            </div>

            {/* Summe */}
            <div className="pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground">Gesamt</p>
                <p className="text-lg font-semibold text-foreground">
                  {calculation.total.toFixed(2)} €
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Provisionsübersicht */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Provisionsübersicht alle Partner</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Code</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Typ</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Provision</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Aufteilung</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(PARTNER_CONFIGS).map(([code, cfg]) => (
                  <tr key={code} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-2 px-3 font-medium text-foreground">{cfg.label}</td>
                    <td className="py-2 px-3 text-muted-foreground">
                      {cfg.type === 'percentage' ? 'Prozent' : 'Fix'}
                    </td>
                    <td className="py-2 px-3 text-foreground">
                      {code === 'KEIN_CODE' 
                        ? '—' 
                        : cfg.type === 'percentage' 
                          ? `${cfg.value}%`
                          : '150€ + Vorjahre'}
                    </td>
                    <td className="py-2 px-3 text-muted-foreground text-xs">
                      {code === 'KEIN_CODE' 
                        ? '130€ (B), Rest (U)'
                        : code === 'ALPHA'
                          ? '30% zu U'
                          : cfg.type === 'percentage'
                            ? `${cfg.value}% (V), 130€ (B), Rest (U)`
                            : '150€+ (V), 130€ (B), Rest (U)'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
