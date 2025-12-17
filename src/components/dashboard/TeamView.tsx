import { Button } from '@/components/ui/button';

export function TeamView() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Team</h2>
        <Button size="sm" className="bg-primary text-primary-foreground">
          Einladen
        </Button>
      </div>
      
      <div className="bg-card/40 backdrop-blur-sm border border-border rounded-xl min-h-[300px] flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground">Team-Mitglieder</p>
          <p className="text-sm text-muted-foreground/70">
            Verwalten Sie hier Ihr Team und Berechtigungen
          </p>
        </div>
      </div>
    </div>
  );
}
