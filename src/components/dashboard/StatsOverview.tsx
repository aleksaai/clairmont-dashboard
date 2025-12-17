interface StatCardProps {
  label: string;
  value: number;
}

function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="bg-card/40 backdrop-blur-sm border border-border rounded-xl p-5 space-y-2">
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

export function StatsOverview() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard label="Neue Anfragen" value={0} />
      <StatCard label="Bezahlt" value={0} />
      <StatCard label="In Bearbeitung" value={0} />
      <StatCard label="Abgeschlossen" value={0} />
    </div>
  );
}
