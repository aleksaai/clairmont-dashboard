import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Settings, LogOut } from 'lucide-react';
import logo from '@/assets/logo.png';
import { MobileMenu } from './MobileMenu';

interface HeaderProps {
  userName: string | null;
  userRole: string | null;
  avatarUrl?: string | null;
  activeSection: string;
  onSectionChange: (section: string) => void;
  onSignOut: () => void;
  unreadMessageCount?: number;
}

const navItems = [
  { id: 'ordner', label: 'Drive' },
  { id: 'chats', label: 'Chats' },
  { id: 'team', label: 'Team' },
  { id: 'kb', label: 'KB', adminOnly: true },
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

export function Header({ userName, userRole, avatarUrl, activeSection, onSectionChange, onSignOut, unreadMessageCount = 0 }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="h-14 border-b border-border bg-card/50 backdrop-blur-sm flex items-center px-3 md:px-6">
      {/* Left: Logo + Navigation (Desktop) / Empty space for centering (Mobile) */}
      <div className="hidden md:flex items-center gap-4 md:gap-8">
        <div className="flex items-center gap-2">
          <img src={logo} alt="Clairmont Advisory" className="h-7 w-auto" />
          <span className="hidden md:inline text-lg font-semibold text-foreground tracking-tight">
            Clairmont Advisory
          </span>
        </div>
        
        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems
            .filter((item) => !item.adminOnly || userRole === 'admin')
            .map((item) => (
              <button
                key={item.id}
                onClick={() => onSectionChange(item.id)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors relative',
                  activeSection === item.id
                    ? 'bg-primary/20 text-foreground'
                    : 'text-muted-foreground'
                )}
              >
                {item.label}
                {item.id === 'chats' && unreadMessageCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-destructive text-destructive-foreground text-xs font-bold rounded-full flex items-center justify-center px-1">
                    {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                  </span>
                )}
              </button>
            ))}
        </nav>
      </div>

      {/* Mobile: Centered Logo */}
      <div className="flex-1 flex justify-center md:hidden">
        <img src={logo} alt="Clairmont Advisory" className="h-7 w-auto" />
      </div>

      {/* Center: Search - Hidden on mobile */}
      <div className="hidden lg:flex flex-1 justify-center px-8">
        <input
          type="text"
          placeholder="Suchen..."
          className="bg-input/50 border border-border rounded-lg px-4 py-1.5 text-sm text-foreground placeholder:text-muted-foreground w-80 focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Spacer for desktop without search */}
      <div className="hidden md:flex lg:hidden flex-1" />

      {/* Mobile: Burger Menu (right) */}
      <MobileMenu
        userName={userName}
        userRole={userRole}
        avatarUrl={avatarUrl}
        activeSection={activeSection}
        onSectionChange={onSectionChange}
        onSignOut={onSignOut}
        unreadMessageCount={unreadMessageCount}
        isOpen={mobileMenuOpen}
        onOpenChange={setMobileMenuOpen}
      />

      {/* Right: User Info + Avatar with Dropdown - Hidden on mobile */}
      <div className="hidden md:flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-medium text-foreground">{userName || 'Benutzer'}</p>
          <p className="text-xs text-muted-foreground">{getRoleLabel(userRole)}</p>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-9 h-9 rounded-full bg-primary/30 flex items-center justify-center overflow-hidden cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background">
              {avatarUrl ? (
                <img src={avatarUrl} alt={userName ?? ''} className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-medium text-foreground">
                  {getInitials(userName)}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => onSectionChange('einstellungen')} className="cursor-pointer">
              <Settings className="w-4 h-4 mr-2" />
              Einstellungen
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onSignOut} className="cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="w-4 h-4 mr-2" />
              Abmelden
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
