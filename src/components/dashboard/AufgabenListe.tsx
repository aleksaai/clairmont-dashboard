import { Button } from '@/components/ui/button';

export function AufgabenListe() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Aufgaben</h2>
        <Button size="sm" className="bg-primary text-primary-foreground">
          Neue Aufgabe
        </Button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Offen */}
        <div className="bg-card/40 backdrop-blur-sm border border-border rounded-xl p-4">
          <p className="text-sm font-medium text-foreground mb-4">Offen</p>
          <div className="flex items-center justify-center h-32">
            <p className="text-sm text-muted-foreground/70">Keine offenen Aufgaben</p>
          </div>
        </div>
        
        {/* In Bearbeitung */}
        <div className="bg-card/40 backdrop-blur-sm border border-border rounded-xl p-4">
          <p className="text-sm font-medium text-foreground mb-4">In Bearbeitung</p>
          <div className="flex items-center justify-center h-32">
            <p className="text-sm text-muted-foreground/70">Keine Aufgaben</p>
          </div>
        </div>
        
        {/* Erledigt */}
        <div className="bg-card/40 backdrop-blur-sm border border-border rounded-xl p-4">
          <p className="text-sm font-medium text-foreground mb-4">Erledigt</p>
          <div className="flex items-center justify-center h-32">
            <p className="text-sm text-muted-foreground/70">Keine Aufgaben</p>
          </div>
        </div>
      </div>
    </div>
  );
}
