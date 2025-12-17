import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export default function Dashboard() {
  const { user, role, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast({
        title: 'Fehler beim Abmelden',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      navigate('/auth');
    }
  };

  const getRoleLabel = (role: string | null) => {
    switch (role) {
      case 'admin':
        return 'Administrator';
      case 'sachbearbeiter':
        return 'Sachbearbeiter';
      case 'vertriebler':
        return 'Vertriebler';
      default:
        return 'Unbekannt';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="glass p-8">
          <p className="text-muted-foreground">Laden...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="glass p-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Clairmont</h1>
            <p className="text-sm text-muted-foreground">Mandanten-Verwaltung</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-foreground">{user?.email}</p>
              <p className="text-xs text-muted-foreground">{getRoleLabel(role)}</p>
            </div>
            <Button
              onClick={handleSignOut}
              variant="outline"
              className="bg-secondary/50 border-glass-border text-foreground"
            >
              Abmelden
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-subtle p-5 space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Neue Anfragen</p>
            <p className="text-2xl font-semibold text-status-new">0</p>
          </div>
          <div className="glass-subtle p-5 space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Bezahlt</p>
            <p className="text-2xl font-semibold text-status-paid">0</p>
          </div>
          <div className="glass-subtle p-5 space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">In Bearbeitung</p>
            <p className="text-2xl font-semibold text-status-progress">0</p>
          </div>
          <div className="glass-subtle p-5 space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Abgeschlossen</p>
            <p className="text-2xl font-semibold text-status-done">0</p>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="glass p-6 min-h-[400px] flex items-center justify-center">
          <div className="text-center space-y-2">
            <p className="text-muted-foreground">Noch keine Mandanten vorhanden</p>
            <p className="text-sm text-muted-foreground/70">
              Mandanten werden hier angezeigt, sobald sie erstellt werden
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}