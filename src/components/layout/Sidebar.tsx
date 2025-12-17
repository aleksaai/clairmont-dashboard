import { cn } from '@/lib/utils';

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'mandanten', label: 'Mandanten' },
  { id: 'ordner', label: 'Ordner' },
  { id: 'dokumente', label: 'Dokumente' },
  { id: 'chats', label: 'Chats' },
  { id: 'aufgaben', label: 'Aufgaben' },
  { id: 'kalender', label: 'Kalender' },
  { id: 'berichte', label: 'Berichte' },
];

const adminItems = [
  { id: 'team', label: 'Team' },
  { id: 'einstellungen', label: 'Einstellungen' },
];

export function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
  return (
    <aside className="w-64 min-h-screen bg-sidebar-background border-r border-sidebar-border flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <h1 className="text-xl font-semibold text-sidebar-foreground tracking-tight">
          Clairmont
        </h1>
        <p className="text-xs text-muted-foreground mt-1">Mandanten-Verwaltung</p>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onSectionChange(item.id)}
            className={cn(
              'w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors',
              activeSection === item.id
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground/70'
            )}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* Admin Section */}
      <div className="p-4 border-t border-sidebar-border space-y-1">
        {adminItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onSectionChange(item.id)}
            className={cn(
              'w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors',
              activeSection === item.id
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground/70'
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
    </aside>
  );
}
