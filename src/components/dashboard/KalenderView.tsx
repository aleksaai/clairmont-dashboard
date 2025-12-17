import { Button } from '@/components/ui/button';

export function KalenderView() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Kalender</h2>
        <Button size="sm" className="bg-primary text-primary-foreground">
          Neuer Termin
        </Button>
      </div>
      
      <div className="bg-card/40 backdrop-blur-sm border border-border rounded-xl min-h-[400px] flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground">Kalender-Ansicht</p>
          <p className="text-sm text-muted-foreground/70">
            Termine und Fristen werden hier angezeigt
          </p>
        </div>
      </div>
    </div>
  );
}
