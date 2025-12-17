import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Settings, LogOut } from 'lucide-react';

interface HeaderProps {
  userName: string | null;
  userRole: string | null;
  avatarUrl?: string | null;
  activeSection: string;
  onSectionChange: (section: string) => void;
  onSignOut: () => void;
}

const navItems = [
  { id: 'ordner', label: 'Drive' },
  { id: 'chats', label: 'Chats' },
  { id: 'team', label: 'Team' },
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

export function Header({ userName, userRole, avatarUrl, activeSection, onSectionChange, onSignOut }: HeaderProps) {
  return (
    <header className="h-14 border-b border-border bg-card/50 backdrop-blur-sm flex items-center px-6">
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

      {/* Center: Search */}
      <div className="flex-1 flex justify-center px-8">
        <input
          type="text"
          placeholder="Suchen..."
          className="bg-input/50 border border-border rounded-lg px-4 py-1.5 text-sm text-foreground placeholder:text-muted-foreground w-80 focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Right: User Info + Avatar with Dropdown */}
      <div className="flex items-center gap-3">
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
