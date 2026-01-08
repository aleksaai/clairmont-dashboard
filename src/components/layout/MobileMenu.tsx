import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu, Settings, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileMenuProps {
  userName: string | null;
  userRole: string | null;
  avatarUrl?: string | null;
  activeSection: string;
  onSectionChange: (section: string) => void;
  onSignOut: () => void;
  unreadMessageCount?: number;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const navItems = [
  { id: 'ordner', label: 'Drive' },
  { id: 'chats', label: 'Chats' },
  { id: 'team', label: 'Team' },
  { id: 'kb', label: 'Knowledge Base', adminOnly: true },
  { id: 'provision', label: 'Provision', adminOnly: true },
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

const getInitials = (name: string | null) => {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

export function MobileMenu({
  userName,
  userRole,
  avatarUrl,
  activeSection,
  onSectionChange,
  onSignOut,
  unreadMessageCount = 0,
  isOpen,
  onOpenChange,
}: MobileMenuProps) {
  const handleNavClick = (sectionId: string) => {
    onSectionChange(sectionId);
    onOpenChange(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0 bg-card border-border">
        {/* User Info */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/30 flex items-center justify-center overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt={userName ?? ''} className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-medium text-foreground">
                  {getInitials(userName)}
                </span>
              )}
            </div>
            <div>
              <p className="font-medium text-foreground">{userName || 'Benutzer'}</p>
              <p className="text-sm text-muted-foreground">{getRoleLabel(userRole)}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-2">
          {navItems
            .filter((item) => !item.adminOnly || userRole === 'admin')
            .map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={cn(
                  'w-full flex items-center justify-between px-4 py-3 rounded-lg text-left font-medium transition-colors',
                  activeSection === item.id
                    ? 'bg-primary/20 text-foreground'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                )}
              >
                <span>{item.label}</span>
                {item.id === 'chats' && unreadMessageCount > 0 && (
                  <span className="min-w-[20px] h-5 bg-destructive text-destructive-foreground text-xs font-bold rounded-full flex items-center justify-center px-1.5">
                    {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                  </span>
                )}
              </button>
            ))}
        </nav>

        {/* Bottom Actions */}
        <div className="absolute bottom-0 left-0 right-0 p-2 border-t border-border bg-card">
          <button
            onClick={() => handleNavClick('einstellungen')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
          >
            <Settings className="w-5 h-5" />
            <span>Einstellungen</span>
          </button>
          <button
            onClick={() => {
              onOpenChange(false);
              onSignOut();
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>Abmelden</span>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
