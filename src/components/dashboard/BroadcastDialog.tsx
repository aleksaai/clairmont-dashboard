import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Megaphone, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Recipient {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
}

export function BroadcastDialog() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);

    (async () => {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .neq('id', user.id);

      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role');

      const list: Recipient[] = (profiles || []).map(p => ({
        ...p,
        role: roles?.find(r => r.user_id === p.id)?.role || 'unknown',
      })).filter(r => r.role !== 'unknown');

      setRecipients(list);
      setLoading(false);
    })();
  }, [open, user]);

  const toggleRecipient = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectByRole = (role: string) => {
    const ids = recipients.filter(r => r.role === role).map(r => r.id);
    setSelected(prev => {
      const next = new Set(prev);
      const allSelected = ids.every(id => next.has(id));
      if (allSelected) {
        ids.forEach(id => next.delete(id));
      } else {
        ids.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === recipients.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(recipients.map(r => r.id)));
    }
  };

  const handleSend = async () => {
    if (!message.trim() || selected.size === 0 || !user) return;
    setSending(true);

    try {
      const rows = Array.from(selected).map(receiverId => ({
        sender_id: user.id,
        receiver_id: receiverId,
        content: message.trim(),
      }));

      const { error } = await supabase.from('messages').insert(rows);
      if (error) throw error;

      // Send email notifications (fire-and-forget)
      const { data: senderProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      for (const receiverId of selected) {
        supabase.functions.invoke('notify-vertriebler', {
          body: {
            type: 'chat_message',
            vertrieblerUserId: receiverId,
            senderName: senderProfile?.full_name || 'Admin',
            messagePreview: message.trim().slice(0, 100),
          },
        }).catch(() => {});
      }

      toast.success(`Nachricht an ${selected.size} Empfänger gesendet`);
      setMessage('');
      setSelected(new Set());
      setOpen(false);
    } catch (err) {
      console.error('Broadcast error:', err);
      toast.error('Fehler beim Senden der Broadcast-Nachricht');
    } finally {
      setSending(false);
    }
  };

  const roleLabels: Record<string, string> = {
    admin: 'Admins',
    sachbearbeiter: 'Sachbearbeiter',
    vertriebler: 'Vertriebler',
  };

  const groupedByRole = ['admin', 'sachbearbeiter', 'vertriebler'].map(role => ({
    role,
    label: roleLabels[role] || role,
    members: recipients.filter(r => r.role === role),
  })).filter(g => g.members.length > 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Megaphone className="w-4 h-4" />
          Broadcast
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Broadcast-Nachricht</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex flex-col gap-4 flex-1 min-h-0">
            {/* Role quick-select */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selected.size === recipients.length ? 'default' : 'outline'}
                size="sm"
                onClick={selectAll}
              >
                Alle ({recipients.length})
              </Button>
              {groupedByRole.map(g => {
                const allInRole = g.members.every(m => selected.has(m.id));
                return (
                  <Button
                    key={g.role}
                    variant={allInRole ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => selectByRole(g.role)}
                  >
                    {g.label} ({g.members.length})
                  </Button>
                );
              })}
            </div>

            {/* Individual recipients */}
            <div className="flex-1 overflow-y-auto border rounded-lg p-2 space-y-1 max-h-48">
              {groupedByRole.map(g => (
                <div key={g.role}>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-2 py-1">
                    {g.label}
                  </p>
                  {g.members.map(r => (
                    <label
                      key={r.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={selected.has(r.id)}
                        onCheckedChange={() => toggleRecipient(r.id)}
                      />
                      <span className="text-sm truncate">
                        {r.full_name || r.email}
                      </span>
                    </label>
                  ))}
                </div>
              ))}
            </div>

            {/* Message input */}
            <textarea
              placeholder="Nachricht eingeben..."
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={3}
              className="w-full rounded-lg border bg-input/50 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />

            {/* Send button */}
            <Button
              onClick={handleSend}
              disabled={!message.trim() || selected.size === 0 || sending}
              className="w-full"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sende...
                </>
              ) : (
                <>
                  <Megaphone className="w-4 h-4 mr-2" />
                  An {selected.size} Empfänger senden
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
