import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, User, FolderOpen, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface SearchResult {
  id: string;
  name: string;
  type: 'customer' | 'team';
  subtitle?: string;
}

interface SearchBarProps {
  onNavigate: (section: string, context?: { folderId?: string; userId?: string }) => void;
}

export function SearchBar({ onNavigate }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    try {
      const [foldersRes, profilesRes] = await Promise.all([
        supabase
          .from('folders')
          .select('id, customer_name, partner_code, status')
          .ilike('customer_name', `%${q}%`)
          .limit(8),
        supabase
          .from('profiles')
          .select('id, full_name, email')
          .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
          .limit(5),
      ]);

      const items: SearchResult[] = [];

      if (profilesRes.data) {
        profilesRes.data.forEach((p) => {
          items.push({
            id: p.id,
            name: p.full_name || p.email || 'Unbekannt',
            type: 'team',
            subtitle: p.email || undefined,
          });
        });
      }

      if (foldersRes.data) {
        const seen = new Set<string>();
        foldersRes.data.forEach((f) => {
          const key = f.customer_name?.toLowerCase();
          if (key && !seen.has(key)) {
            seen.add(key);
            items.push({
              id: f.id,
              name: f.customer_name,
              type: 'customer',
              subtitle: f.partner_code ? `Partner: ${f.partner_code}` : undefined,
            });
          }
        });
      }

      setResults(items);
      setIsOpen(items.length > 0);
      setSelectedIndex(-1);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (result: SearchResult) => {
    if (result.type === 'customer') {
      onNavigate('ordner', { folderId: result.id });
    } else {
      onNavigate('chats', { userId: result.id });
    }
    setQuery('');
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => (i < results.length - 1 ? i + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => (i > 0 ? i - 1 : results.length - 1));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const teamResults = results.filter((r) => r.type === 'team');
  const customerResults = results.filter((r) => r.type === 'customer');

  let flatIndex = -1;

  return (
    <div ref={containerRef} className="relative w-80">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Kunden, Mitarbeiter suchen..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="glass-input pl-9 pr-8 py-1.5 text-sm text-foreground placeholder:text-muted-foreground w-full focus:outline-none"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
              setIsOpen(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute top-full mt-2 w-full glass border border-white/[0.08] rounded-xl overflow-hidden shadow-2xl shadow-black/20 z-50">
          {teamResults.length > 0 && (
            <div>
              <p className="px-3 pt-2.5 pb-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Team
              </p>
              {teamResults.map((r) => {
                flatIndex++;
                const idx = flatIndex;
                return (
                  <button
                    key={r.id}
                    onClick={() => handleSelect(r)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                      selectedIndex === idx
                        ? 'bg-white/[0.08]'
                        : 'hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <User className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{r.name}</p>
                      {r.subtitle && (
                        <p className="text-xs text-muted-foreground truncate">{r.subtitle}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {customerResults.length > 0 && (
            <div>
              {teamResults.length > 0 && <div className="border-t border-white/[0.06]" />}
              <p className="px-3 pt-2.5 pb-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Kunden
              </p>
              {customerResults.map((r) => {
                flatIndex++;
                const idx = flatIndex;
                return (
                  <button
                    key={r.id}
                    onClick={() => handleSelect(r)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                      selectedIndex === idx
                        ? 'bg-white/[0.08]'
                        : 'hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                      <FolderOpen className="h-3.5 w-3.5 text-emerald-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{r.name}</p>
                      {r.subtitle && (
                        <p className="text-xs text-muted-foreground truncate">{r.subtitle}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="px-3 py-2 border-t border-white/[0.06]">
            <p className="text-[11px] text-muted-foreground">
              <kbd className="px-1 py-0.5 bg-white/[0.06] rounded text-[10px]">↑↓</kbd> navigieren
              {' '}<kbd className="px-1 py-0.5 bg-white/[0.06] rounded text-[10px]">↵</kbd> auswählen
              {' '}<kbd className="px-1 py-0.5 bg-white/[0.06] rounded text-[10px]">Esc</kbd> schließen
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
