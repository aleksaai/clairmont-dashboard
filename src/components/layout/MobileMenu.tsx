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
  { id: 'provision', label: 'Provision', roles: ['admin', 'vertriebler'] },
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
        <Button variant="ghost" size="icon" className="md:hidden text-muted-foreground hover:text-foreground">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72 p-0 bg-mesh border-l border-white/[0.06]" style={{ backdropFilter: 'blur(40px) saturate(1.8)' }}>
        {/* User Info */}
        <div className="p-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary/40 to-primary/20 flex items-center justify-center overflow-hidden shadow-lg shadow-primary/10">
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
        <nav className="p-3 space-y-0.5">
          {navItems
            .filter((item) => {
              if (item.roles) return item.roles.includes(userRole || '');
              if (item.adminOnly) return userRole === 'admin';
              return true;
            })
            .map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={cn(
                  'w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-left font-medium transition-all duration-200',
                  activeSection === item.id
                    ? 'nav-pill-active text-foreground'
                    : 'text-muted-foreground hover:bg-white/[0.04] hover:text-foreground'
                )}
              >
                <span>{item.label}</span>
                {item.id === 'chats' && unreadMessageCount > 0 && (
                  <span className="min-w-[20px] h-5 bg-destructive text-destructive-foreground text-xs font-bold rounded-full flex items-center justify-center px-1.5 shadow-lg shadow-destructive/30">
                    {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                  </span>
                )}
              </button>
            ))}
        </nav>

        {/* Bottom Actions */}
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-white/[0.06]">
          <button
            onClick={() => handleNavClick('einstellungen')}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-muted-foreground hover:bg-white/[0.04] hover:text-foreground transition-all duration-200"
          >
            <Settings className="w-5 h-5" />
            <span>Einstellungen</span>
          </button>
          <button
            onClick={() => {
              onOpenChange(false);
              onSignOut();
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-destructive hover:bg-destructive/10 transition-all duration-200"
          >
            <LogOut className="w-5 h-5" />
            <span>Abmelden</span>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
