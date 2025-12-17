import { Button } from '@/components/ui/button';

export function BerichteView() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Berichte</h2>
        <Button size="sm" className="bg-primary text-primary-foreground">
          Exportieren
        </Button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card/40 backdrop-blur-sm border border-border rounded-xl p-5 min-h-[200px]">
          <p className="text-sm font-medium text-foreground mb-4">Umsatz Übersicht</p>
          <div className="flex items-center justify-center h-32">
            <p className="text-sm text-muted-foreground/70">Keine Daten</p>
          </div>
        </div>
        
        <div className="bg-card/40 backdrop-blur-sm border border-border rounded-xl p-5 min-h-[200px]">
          <p className="text-sm font-medium text-foreground mb-4">Mandanten Statistik</p>
          <div className="flex items-center justify-center h-32">
            <p className="text-sm text-muted-foreground/70">Keine Daten</p>
          </div>
        </div>
        
        <div className="bg-card/40 backdrop-blur-sm border border-border rounded-xl p-5 min-h-[200px]">
          <p className="text-sm font-medium text-foreground mb-4">Produkt Verteilung</p>
          <div className="flex items-center justify-center h-32">
            <p className="text-sm text-muted-foreground/70">Keine Daten</p>
          </div>
        </div>
        
        <div className="bg-card/40 backdrop-blur-sm border border-border rounded-xl p-5 min-h-[200px]">
          <p className="text-sm font-medium text-foreground mb-4">Team Leistung</p>
          <div className="flex items-center justify-center h-32">
            <p className="text-sm text-muted-foreground/70">Keine Daten</p>
          </div>
        </div>
      </div>
    </div>
  );
}
