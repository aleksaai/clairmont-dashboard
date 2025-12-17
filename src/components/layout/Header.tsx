import { Button } from '@/components/ui/button';

interface HeaderProps {
  userEmail: string | undefined;
  userRole: string | null;
  onSignOut: () => void;
}

const getRoleLabel = (role: string | null) => {
  switch (role) {
    case 'admin':
      return 'Administrator';
    case 'sachbearbeiter':
      return 'Sachbearbeiter';
    case 'vertriebler':
      return 'Vertriebler';
    default:
      return 'Vertriebler';
  }
};

export function Header({ userEmail, userRole, onSignOut }: HeaderProps) {
  return (
    <header className="h-16 border-b border-border bg-card/30 backdrop-blur-sm flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <input
          type="text"
          placeholder="Suchen..."
          className="bg-input/50 border border-border rounded-lg px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground w-64 focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm text-foreground">{userEmail}</p>
          <p className="text-xs text-muted-foreground">{getRoleLabel(userRole)}</p>
        </div>
        <Button
          onClick={onSignOut}
          variant="outline"
          size="sm"
          className="bg-secondary/50 border-border"
        >
          Abmelden
        </Button>
      </div>
    </header>
  );
}
