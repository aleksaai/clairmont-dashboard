import { Button } from '@/components/ui/button';

export function MandantenListe() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Mandanten</h2>
        <Button size="sm" className="bg-primary text-primary-foreground">
          Neuer Mandant
        </Button>
      </div>
      
      <div className="bg-card/40 backdrop-blur-sm border border-border rounded-xl min-h-[300px] flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground">Noch keine Mandanten vorhanden</p>
          <p className="text-sm text-muted-foreground/70">
            Erstellen Sie einen neuen Mandanten um zu beginnen
          </p>
        </div>
      </div>
    </div>
  );
}
