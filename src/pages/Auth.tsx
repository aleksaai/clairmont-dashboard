import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Ungültige E-Mail-Adresse'),
  password: z.string().min(6, 'Passwort muss mindestens 6 Zeichen haben'),
});

const forgotSchema = z.object({
  email: z.string().email('Ungültige E-Mail-Adresse'),
});

type Mode = 'login' | 'forgot';

export default function Auth() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [forgotSent, setForgotSent] = useState(false);

  const { signIn, resetPassword, user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  const validateForm = () => {
    try {
      loginSchema.parse({ email, password });
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const { error } = await signIn(email, password);
      if (error) {
        toast({
          title: 'Anmeldung fehlgeschlagen',
          description: error.message === 'Invalid login credentials'
            ? 'E-Mail oder Passwort ist falsch'
            : error.message,
          variant: 'destructive',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Forgot-Modus validiert nur die Email
    try {
      forgotSchema.parse({ email });
      setErrors({});
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
      }
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await resetPassword(email);
      if (error) {
        // Supabase-Fehler (Rate-Limit, Netzwerk etc.) — zeigen wir an
        toast({
          title: 'Fehler',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        // Success — WICHTIG: wir zeigen dieselbe Nachricht egal ob Email existiert
        // (Security-Best-Practice gegen Email-Enumeration)
        setForgotSent(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchToForgot = () => {
    setMode('forgot');
    setPassword('');
    setErrors({});
    setForgotSent(false);
  };

  const switchToLogin = () => {
    setMode('login');
    setErrors({});
    setForgotSent(false);
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
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="glass p-8 space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">
              Clairmont
            </h1>
            <p className="text-muted-foreground text-sm">
              {mode === 'login' ? 'Melden Sie sich an' : 'Passwort zurücksetzen'}
            </p>
          </div>

          {mode === 'login' && (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground/80">
                    E-Mail
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="glass-input bg-input/30 border-glass-border focus:border-ring"
                    placeholder="name@beispiel.de"
                  />
                  {errors.email && (
                    <p className="text-destructive text-xs">{errors.email}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-foreground/80">
                    Passwort
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="glass-input bg-input/30 border-glass-border focus:border-ring"
                    placeholder="••••••••"
                  />
                  {errors.password && (
                    <p className="text-destructive text-xs">{errors.password}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-primary text-primary-foreground border-0 rounded-lg py-5"
                >
                  {isSubmitting ? 'Wird verarbeitet...' : 'Anmelden'}
                </Button>
              </form>

              <div className="text-center">
                <button
                  type="button"
                  onClick={switchToForgot}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
                >
                  Passwort vergessen?
                </button>
              </div>

              <p className="text-center text-xs text-muted-foreground">
                Kontaktieren Sie einen Administrator, um Zugang zu erhalten.
              </p>
            </>
          )}

          {mode === 'forgot' && !forgotSent && (
            <>
              <p className="text-sm text-muted-foreground text-center">
                Geben Sie Ihre E-Mail-Adresse ein. Wir senden Ihnen einen Link, mit dem Sie ein neues Passwort festlegen können.
              </p>

              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgot-email" className="text-foreground/80">
                    E-Mail
                  </Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="glass-input bg-input/30 border-glass-border focus:border-ring"
                    placeholder="name@beispiel.de"
                    autoFocus
                  />
                  {errors.email && (
                    <p className="text-destructive text-xs">{errors.email}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-primary text-primary-foreground border-0 rounded-lg py-5"
                >
                  {isSubmitting ? 'Wird gesendet...' : 'Link anfordern'}
                </Button>
              </form>

              <div className="text-center">
                <button
                  type="button"
                  onClick={switchToLogin}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
                >
                  ← Zurück zum Login
                </button>
              </div>
            </>
          )}

          {mode === 'forgot' && forgotSent && (
            <>
              <div className="text-center space-y-3">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                  <svg
                    className="w-6 h-6 text-primary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <p className="text-sm text-foreground">
                  Falls ein Account mit dieser E-Mail existiert, haben wir Ihnen einen Link zum Zurücksetzen des Passworts geschickt.
                </p>
                <p className="text-xs text-muted-foreground">
                  Bitte prüfen Sie auch Ihren Spam-Ordner. Der Link ist 24 Stunden gültig.
                </p>
              </div>

              <Button
                type="button"
                onClick={switchToLogin}
                variant="outline"
                className="w-full rounded-lg py-5"
              >
                Zurück zum Login
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
