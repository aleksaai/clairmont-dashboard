import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface HeaderProps {
  userEmail: string | undefined;
  userRole: string | null;
  activeSection: string;
  onSectionChange: (section: string) => void;
  onSignOut: () => void;
}

const navItems = [
  { id: 'ordner', label: 'Drive' },
  { id: 'chats', label: 'Chats' },
  { id: 'team', label: 'Team' },
  { id: 'einstellungen', label: 'Einstellungen' },
];

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

export function Header({ userEmail, userRole, activeSection, onSectionChange, onSignOut }: HeaderProps) {
  return (
    <header className="h-14 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-6">
      {/* Left: Logo + Navigation */}
      <div className="flex items-center gap-8">
        <h1 className="text-lg font-semibold text-foreground tracking-tight">
          Clairmont
        </h1>
        
        <nav className="flex items-center gap-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                activeSection === item.id
                  ? 'bg-primary/20 text-foreground'
                  : 'text-muted-foreground'
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Right: Search + User */}
      <div className="flex items-center gap-4">
        <input
          type="text"
          placeholder="Suchen..."
          className="bg-input/50 border border-border rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground w-48 focus:outline-none focus:ring-1 focus:ring-ring"
        />
        
        <div className="flex items-center gap-3">
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
      </div>
    </header>
  );
}
