import { Button } from '@/components/ui/button';

export function DokumenteListe() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Dokumente</h2>
        <Button size="sm" className="bg-primary text-primary-foreground">
          Hochladen
        </Button>
      </div>
      
      <div className="bg-card/40 backdrop-blur-sm border border-border rounded-xl min-h-[300px] flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground">Noch keine Dokumente vorhanden</p>
          <p className="text-sm text-muted-foreground/70">
            Laden Sie Dokumente hoch oder verknüpfen Sie sie mit Mandanten
          </p>
        </div>
      </div>
    </div>
  );
}
