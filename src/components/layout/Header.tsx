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
import { SearchBar } from './SearchBar';

interface HeaderProps {
  userName: string | null;
  userRole: string | null;
  avatarUrl?: string | null;
  activeSection: string;
  onSectionChange: (section: string) => void;
  onNavigate: (section: string, context?: { folderId?: string; userId?: string }) => void;
  onSignOut: () => void;
  unreadMessageCount?: number;
}

const navItems = [
  { id: 'ordner', label: 'Drive' },
  { id: 'chats', label: 'Chats' },
  { id: 'team', label: 'Team' },
  { id: 'kb', label: 'KB', adminOnly: true },
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

export function Header({ userName, userRole, avatarUrl, activeSection, onSectionChange, onNavigate, onSignOut, unreadMessageCount = 0 }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="glass-header sticky top-0 z-50 h-14 flex items-center px-3 md:px-6">
      {/* Left: Logo + Navigation (Desktop) */}
      <div className="hidden md:flex items-center gap-6">
        <button
          onClick={() => onSectionChange('ordner')}
          className="flex items-center hover:opacity-80 transition-opacity"
        >
          <img src={logo} alt="Clairmont" className="h-7 w-auto" />
        </button>

        {/* Desktop Navigation — pill-style tabs */}
        <nav className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03]">
          {navItems
            .filter((item) => {
              if (item.roles) return item.roles.includes(userRole || '');
              if (item.adminOnly) return userRole === 'admin';
              return true;
            })
            .map((item) => (
              <button
                key={item.id}
                onClick={() => onSectionChange(item.id)}
                className={cn(
                  'px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 relative',
                  activeSection === item.id
                    ? 'nav-pill-active text-foreground'
                    : 'text-muted-foreground hover:text-foreground/80 hover:bg-white/[0.04]'
                )}
              >
                {item.label}
                {item.id === 'chats' && unreadMessageCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-destructive text-destructive-foreground text-[11px] font-bold rounded-full flex items-center justify-center px-1 shadow-lg shadow-destructive/30">
                    {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                  </span>
                )}
              </button>
            ))}
        </nav>
      </div>

      {/* Mobile: Centered Logo */}
      <div className="flex-1 flex justify-center md:hidden">
        <button onClick={() => onSectionChange('ordner')} className="hover:opacity-80 transition-opacity">
          <img src={logo} alt="Clairmont Advisory" className="h-7 w-auto" />
        </button>
      </div>

      {/* Center: Search */}
      <div className="hidden lg:flex flex-1 justify-center px-8">
        <SearchBar onNavigate={onNavigate} />
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

      {/* Right: User Info + Avatar with Dropdown */}
      <div className="hidden md:flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-medium text-foreground">{userName || 'Benutzer'}</p>
          <p className="text-xs text-muted-foreground">{getRoleLabel(userRole)}</p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/40 to-primary/20 flex items-center justify-center overflow-hidden cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-2 focus:ring-offset-background transition-shadow hover:shadow-lg hover:shadow-primary/10">
              {avatarUrl ? (
                <img src={avatarUrl} alt={userName ?? ''} className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-medium text-foreground">
                  {getInitials(userName)}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 glass border-white/[0.08]">
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
