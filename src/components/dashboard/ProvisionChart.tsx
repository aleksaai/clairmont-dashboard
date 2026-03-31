import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart } from 'recharts';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { de } from 'date-fns/locale';
import { TrendingUp } from 'lucide-react';

interface ProvisionConfig {
  partner_code: string;
  provision_type: 'fixed' | 'percentage';
  provision_value: number;
  bookkeeper_fee: number;
}

interface ProvisionChartProps {
  configMap: Record<string, ProvisionConfig>;
}

export function ProvisionChart({ configMap }: ProvisionChartProps) {
  // Fetch paid folders for last 6 months
  const sixMonthsAgo = startOfMonth(subMonths(new Date(), 5));

  const { data: allFolders, isLoading } = useQuery({
    queryKey: ['provision-chart-data'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('folders')
        .select('id, partner_code, prognose_amount, updated_at')
        .eq('status', 'bezahlt')
        .not('partner_code', 'is', null)
        .gte('updated_at', sixMonthsAgo.toISOString());

      if (error) throw error;
      return data || [];
    },
  });

  const chartData = useMemo(() => {
    if (!allFolders) return [];

    const months: { key: string; label: string; start: Date; end: Date }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const s = startOfMonth(d);
      months.push({
        key: format(s, 'yyyy-MM'),
        label: format(s, 'MMM yy', { locale: de }),
        start: s,
        end: endOfMonth(s),
      });
    }

    return months.map(m => {
      const monthFolders = allFolders.filter(f => {
        const updated = new Date(f.updated_at);
        return updated >= m.start && updated <= m.end;
      });

      let umsatz = 0;
      let provisionen = 0;
      const kunden = monthFolders.length;

      monthFolders.forEach(f => {
        const rawAmount = f.prognose_amount || 0;
        const amount = rawAmount * 0.3;
        umsatz += amount;

        const code = f.partner_code?.toUpperCase() || '';
        const config = configMap[code] || configMap['DEFAULT'];
        if (config) {
          provisionen += config.provision_type === 'percentage'
            ? rawAmount * (config.provision_value / 100)
            : config.provision_value;
        }
      });

      return {
        name: m.label,
        umsatz: Math.round(umsatz),
        provisionen: Math.round(provisionen),
        kunden,
      };
    });
  }, [allFolders, configMap]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">Laden...</p>
        </CardContent>
      </Card>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
        <p className="font-medium text-foreground mb-1">{label}</p>
        {payload.map((entry: any, i: number) => (
          <p key={i} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {entry.value.toLocaleString('de-DE')} {entry.name === 'Kunden' ? '' : '€'}
          </p>
        ))}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Entwicklung (6 Monate)</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" className="text-xs fill-muted-foreground" tick={{ fontSize: 12 }} />
              <YAxis className="text-xs fill-muted-foreground" tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="umsatz" name="Umsatz" fill="#60a5fa" radius={[4, 4, 0, 0]} opacity={0.5} />
              <Bar dataKey="provisionen" name="Provisionen" fill="#38bdf8" radius={[4, 4, 0, 0]} />
              <Line dataKey="kunden" name="Kunden" stroke="#a78bfa" strokeWidth={2} dot={{ r: 3 }} yAxisId={1} />
              <YAxis yAxisId={1} orientation="right" tick={{ fontSize: 12 }} className="text-xs fill-muted-foreground" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-6 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#60a5fa', opacity: 0.5 }} />
            <span className="text-muted-foreground">Umsatz (30% Gebühr)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#38bdf8' }} />
            <span className="text-muted-foreground">Provisionen</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#a78bfa' }} />
            <span className="text-muted-foreground">Kunden</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
