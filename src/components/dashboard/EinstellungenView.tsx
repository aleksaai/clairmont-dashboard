export function EinstellungenView() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Einstellungen</h2>
      
      <div className="space-y-4">
        <div className="bg-card/40 backdrop-blur-sm border border-border rounded-xl p-5">
          <p className="text-sm font-medium text-foreground mb-2">Profil</p>
          <p className="text-sm text-muted-foreground">Persönliche Einstellungen und Profildaten</p>
        </div>
        
        <div className="bg-card/40 backdrop-blur-sm border border-border rounded-xl p-5">
          <p className="text-sm font-medium text-foreground mb-2">Benachrichtigungen</p>
          <p className="text-sm text-muted-foreground">E-Mail und Push-Benachrichtigungen konfigurieren</p>
        </div>
        
        <div className="bg-card/40 backdrop-blur-sm border border-border rounded-xl p-5">
          <p className="text-sm font-medium text-foreground mb-2">Integrationen</p>
          <p className="text-sm text-muted-foreground">Externe Dienste und APIs verbinden</p>
        </div>
        
        <div className="bg-card/40 backdrop-blur-sm border border-border rounded-xl p-5">
          <p className="text-sm font-medium text-foreground mb-2">Sicherheit</p>
          <p className="text-sm text-muted-foreground">Passwort und Zwei-Faktor-Authentifizierung</p>
        </div>
      </div>
    </div>
  );
}
