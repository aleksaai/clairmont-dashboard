import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

/**
 * Landing page after clicking the password-reset link from email.
 *
 * The link Supabase sends carries the recovery token in the URL hash.
 * The Supabase JS client auto-consumes the token on page load and fires
 * a PASSWORD_RECOVERY auth event — at that point the user is signed in
 * with a recovery session and allowed to call updateUser({password}).
 *
 * Also accessible manually: any logged-in user can navigate here to
 * change their password.
 */
export default function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    // Listen for the PASSWORD_RECOVERY event that Supabase fires
    // after consuming the recovery token in the URL hash.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
        setUserEmail(session?.user?.email ?? null);
      }
    });

    // Also: check current session (user might navigate here while already logged in)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserEmail(session.user.email ?? null);
      } else {
        // No session → the recovery flow hasn't completed; wait a moment for the hash to be processed
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast({ title: 'Passwort zu kurz', description: 'Mindestens 8 Zeichen.', variant: 'destructive' });
      return;
    }
    if (newPassword !== confirm) {
      toast({ title: 'Passwörter stimmen nicht überein', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      toast({
        title: 'Passwort erfolgreich geändert',
        description: 'Du wirst zum Dashboard weitergeleitet.',
      });

      // Small delay so the user sees the success toast
      setTimeout(() => navigate('/'), 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
      toast({ title: 'Fehler beim Ändern des Passworts', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <div className="space-y-2 mb-6">
          <h1 className="text-2xl font-bold">
            {isRecovery ? 'Neues Passwort setzen' : 'Passwort ändern'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {userEmail ? `Eingeloggt als: ${userEmail}` : 'Bitte neues Passwort eingeben.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Neues Passwort</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mindestens 8 Zeichen"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm">Passwort bestätigen</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>

          <Button type="submit" disabled={loading || !newPassword || !confirm} className="w-full">
            {loading ? 'Wird gespeichert...' : 'Passwort speichern'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Zurück zum Dashboard
          </button>
        </div>
      </Card>
    </div>
  );
}
