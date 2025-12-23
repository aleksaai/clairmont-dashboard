import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calculator, Euro, Users, TrendingUp, Calendar } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { de } from 'date-fns/locale';

interface ProvisionConfig {
  type: 'fixed' | 'percentage';
  value: number;
  label: string;
}

const PARTNER_CONFIGS: Record<string, ProvisionConfig> = {
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

const BOOKKEEPER_FEE = 130;

function calculateProvision(partnerCode: string, amount: number): number {
  const config = PARTNER_CONFIGS[partnerCode];
  if (!config) return 0;
  
  if (config.type === 'percentage') {
    return amount * (config.value / 100);
  } else {
    // Fixe Provision (vereinfacht - für komplexere Jahr-Logik müsste man mehr Daten haben)
    return config.value;
  }
}

function getMonthOptions() {
  const options = [];
  for (let i = 0; i < 12; i++) {
    const date = subMonths(new Date(), i);
    options.push({
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy', { locale: de }),
    });
  }
  return options;
}

export function ProvisionsrechnerView() {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  
  const monthStart = startOfMonth(new Date(selectedMonth + '-01'));
  const monthEnd = endOfMonth(monthStart);

  // Fetch all paid folders for the selected month
  const { data: paidFolders, isLoading } = useQuery({
    queryKey: ['paid-folders-provisions', selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('folders')
        .select('id, name, customer_name, partner_code, prognose_amount, updated_at, status')
        .eq('status', 'bezahlt')
        .not('partner_code', 'is', null)
        .gte('updated_at', monthStart.toISOString())
        .lte('updated_at', monthEnd.toISOString());
      
      if (error) throw error;
      return data || [];
    },
  });

  // Calculate provisions grouped by partner code
  const provisionsByPartner = useMemo(() => {
    if (!paidFolders) return [];
    
    const grouped: Record<string, { 
      partnerCode: string; 
      totalProvision: number; 
      totalAmount: number;
      folderCount: number;
      folders: typeof paidFolders;
    }> = {};

    paidFolders.forEach(folder => {
      const code = folder.partner_code?.toUpperCase();
      if (!code) return;
      
      const amount = folder.prognose_amount || 0;
      const provision = calculateProvision(code, amount);
      
      if (!grouped[code]) {
        grouped[code] = {
          partnerCode: code,
          totalProvision: 0,
          totalAmount: 0,
          folderCount: 0,
          folders: [],
        };
      }
      
      grouped[code].totalProvision += provision;
      grouped[code].totalAmount += amount;
      grouped[code].folderCount += 1;
      grouped[code].folders.push(folder);
    });

    return Object.values(grouped).sort((a, b) => b.totalProvision - a.totalProvision);
  }, [paidFolders]);

  // Calculate totals
  const totals = useMemo(() => {
    return provisionsByPartner.reduce(
      (acc, p) => ({
        totalProvisions: acc.totalProvisions + p.totalProvision,
        totalAmount: acc.totalAmount + p.totalAmount,
        totalFolders: acc.totalFolders + p.folderCount,
        totalBookkeeper: acc.totalBookkeeper + (p.folderCount * BOOKKEEPER_FEE),
      }),
      { totalProvisions: 0, totalAmount: 0, totalFolders: 0, totalBookkeeper: 0 }
    );
  }, [provisionsByPartner]);

  const monthOptions = getMonthOptions();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calculator className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold text-foreground">Provisionsübersicht</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Zusammenfassung */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Euro className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Gesamtumsatz</p>
                <p className="text-2xl font-bold text-foreground">{totals.totalAmount.toFixed(2)} €</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Vertriebler-Provisionen</p>
                <p className="text-2xl font-bold text-foreground">{totals.totalProvisions.toFixed(2)} €</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <Euro className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Buchhalter (B)</p>
                <p className="text-2xl font-bold text-foreground">{totals.totalBookkeeper.toFixed(2)} €</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Bezahlte Kunden</p>
                <p className="text-2xl font-bold text-foreground">{totals.totalFolders}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Provisionen nach Partner */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Provisionen nach Partnercode</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Laden...</p>
          ) : provisionsByPartner.length === 0 ? (
            <p className="text-muted-foreground">Keine bezahlten Ordner mit Partnercode in diesem Monat.</p>
          ) : (
            <div className="space-y-4">
              {provisionsByPartner.map(partner => {
                const config = PARTNER_CONFIGS[partner.partnerCode];
                return (
                  <div key={partner.partnerCode} className="border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                          <span className="text-sm font-bold text-primary">
                            {partner.partnerCode.substring(0, 2)}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{partner.partnerCode}</p>
                          <p className="text-sm text-muted-foreground">
                            {config?.type === 'percentage' 
                              ? `${config.value}% Provision` 
                              : '150€ + Jahre'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-primary">
                          {partner.totalProvision.toFixed(2)} €
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {partner.folderCount} {partner.folderCount === 1 ? 'Kunde' : 'Kunden'}
                        </p>
                      </div>
                    </div>
                    
                    {/* Details der Kunden */}
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <p className="text-xs text-muted-foreground mb-2">Kunden:</p>
                      <div className="space-y-1">
                        {partner.folders.map(folder => (
                          <div key={folder.id} className="flex justify-between text-sm">
                            <span className="text-foreground">{folder.customer_name}</span>
                            <div className="flex gap-4">
                              <span className="text-muted-foreground">
                                {(folder.prognose_amount || 0).toFixed(2)} €
                              </span>
                              <span className="text-primary font-medium">
                                → {calculateProvision(partner.partnerCode, folder.prognose_amount || 0).toFixed(2)} €
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legende */}
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
                      {cfg.type === 'percentage' ? `${cfg.value}%` : '150€ + Vorjahre'}
                    </td>
                    <td className="py-2 px-3 text-muted-foreground text-xs">
                      {code === 'ALPHA'
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
