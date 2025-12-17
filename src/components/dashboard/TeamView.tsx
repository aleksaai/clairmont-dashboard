import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Mail, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { UserAvatar } from '@/components/UserAvatar';
import { useAuth, AppRole } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface TeamMember {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: AppRole;
  created_at: string;
}

export function TeamView() {
  const { role: currentUserRole } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  
  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    password: '',
    role: 'vertriebler' as AppRole,
  });

  const isAdmin = currentUserRole === 'admin';

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url, created_at');

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      const memberData: TeamMember[] = (profiles || []).map(profile => {
        const userRole = roles?.find(r => r.user_id === profile.id);
        return {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          role: (userRole?.role as AppRole) || 'vertriebler',
          created_at: profile.created_at || '',
        };
      });

      setMembers(memberData);
    } catch (error) {
      console.error('Error fetching members:', error);
      toast.error('Fehler beim Laden der Teammitglieder');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!formData.email || !formData.fullName || !formData.password) {
      toast.error('Bitte füllen Sie alle Felder aus');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Das Passwort muss mindestens 6 Zeichen lang sein');
      return;
    }

    setInviting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify(formData),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Einladung fehlgeschlagen');
      }

      toast.success('Benutzer wurde erfolgreich eingeladen');
      setInviteOpen(false);
      setFormData({ email: '', fullName: '', password: '', role: 'vertriebler' });
      fetchMembers();
    } catch (error: any) {
      console.error('Error inviting user:', error);
      toast.error(error.message || 'Fehler beim Einladen des Benutzers');
    } finally {
      setInviting(false);
    }
  };

  const getRoleBadgeVariant = (role: AppRole) => {
    switch (role) {
      case 'admin': return 'default';
      case 'sachbearbeiter': return 'secondary';
      case 'vertriebler': return 'outline';
      default: return 'outline';
    }
  };

  const getRoleLabel = (role: AppRole) => {
    switch (role) {
      case 'admin': return 'Administrator';
      case 'sachbearbeiter': return 'Sachbearbeiter';
      case 'vertriebler': return 'Vertriebler';
      default: return role;
    }
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, password }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Team</h2>
        {isAdmin && (
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-primary text-primary-foreground">
                <UserPlus className="h-4 w-4 mr-2" />
                Einladen
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Neuen Benutzer einladen</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Vollständiger Name</Label>
                  <Input
                    id="fullName"
                    placeholder="Max Mustermann"
                    value={formData.fullName}
                    onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-Mail-Adresse</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="max@beispiel.de"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Passwort</Label>
                  <div className="flex gap-2">
                    <Input
                      id="password"
                      type="text"
                      placeholder="Passwort"
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    />
                    <Button type="button" variant="outline" onClick={generatePassword}>
                      Generieren
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Mindestens 6 Zeichen. Das Passwort wird dem Benutzer per E-Mail zugesendet.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Rolle</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value: AppRole) => setFormData(prev => ({ ...prev, role: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Rolle auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vertriebler">Vertriebler</SelectItem>
                      <SelectItem value="sachbearbeiter">Sachbearbeiter</SelectItem>
                      <SelectItem value="admin">Administrator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  className="w-full" 
                  onClick={handleInvite}
                  disabled={inviting}
                >
                  {inviting ? 'Wird eingeladen...' : 'Einladung senden'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
      
      <div className="bg-card/40 backdrop-blur-sm border border-border rounded-xl p-4">
        {loading ? (
          <div className="flex items-center justify-center min-h-[200px]">
            <p className="text-muted-foreground">Lädt...</p>
          </div>
        ) : members.length === 0 ? (
          <div className="text-center space-y-2 min-h-[200px] flex flex-col items-center justify-center">
            <p className="text-muted-foreground">Keine Teammitglieder gefunden</p>
            {isAdmin && (
              <p className="text-sm text-muted-foreground/70">
                Laden Sie neue Benutzer über den "Einladen"-Button ein
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {members.map((member) => (
              <Card key={member.id} className="bg-background/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <UserAvatar 
                        avatarUrl={member.avatar_url} 
                        fullName={member.full_name} 
                        size="md"
                      />
                      <div>
                        <p className="font-medium text-foreground">
                          {member.full_name || 'Kein Name'}
                        </p>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {member.email}
                        </p>
                      </div>
                    </div>
                    <Badge variant={getRoleBadgeVariant(member.role)}>
                      <Shield className="h-3 w-3 mr-1" />
                      {getRoleLabel(member.role)}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
