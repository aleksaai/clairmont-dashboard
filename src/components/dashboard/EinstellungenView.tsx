import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Copy, Check, Link } from 'lucide-react';

interface EinstellungenViewProps {
  userName: string | null;
  userEmail: string | undefined;
  avatarUrl?: string | null;
  userId: string | undefined;
  userRole?: string | null;
  onProfileUpdate?: () => void;
}

const getInitials = (name: string | null) => {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

export function EinstellungenView({ userName, userEmail, avatarUrl, userId, userRole, onProfileUpdate }: EinstellungenViewProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [newEmail, setNewEmail] = useState(userEmail || '');
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [partnerCode, setPartnerCode] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    if (userRole === 'vertriebler' && userId) {
      supabase
        .from('partner_codes')
        .select('code')
        .eq('user_id', userId)
        .limit(1)
        .then(({ data }) => {
          if (data && data.length > 0) {
            setPartnerCode(data[0].code);
          }
        });
    }
  }, [userId, userRole]);

  const referralLink = partnerCode
    ? `https://clairmont-advisory.com/prognose?ref=${encodeURIComponent(partnerCode)}`
    : null;

  const handleCopyLink = async () => {
    if (!referralLink) return;
    await navigator.clipboard.writeText(referralLink);
    setLinkCopied(true);
    toast({ title: 'Link kopiert', description: 'Der Empfehlungslink wurde in die Zwischenablage kopiert.' });
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleEmailUpdate = async () => {
    if (!newEmail || newEmail === userEmail) return;
    
    setIsUpdatingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      
      if (error) throw error;
      
      toast({
        title: 'E-Mail-Änderung angefordert',
        description: 'Bitte bestätigen Sie die Änderung über den Link in Ihrer neuen E-Mail.',
      });
    } catch (error: any) {
      toast({
        title: 'Fehler',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  const handleChangePassword = () => {
    navigate('/reset-password');
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !userId) return;

    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const filePath = `${userId}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update profile with avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);

      if (updateError) throw updateError;

      toast({
        title: 'Profilbild aktualisiert',
        description: 'Ihr Profilbild wurde erfolgreich geändert.',
      });

      onProfileUpdate?.();
    } catch (error: any) {
      toast({
        title: 'Fehler beim Hochladen',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      <h2 className="text-lg font-semibold text-foreground">Einstellungen</h2>
      
      {/* Profile Picture */}
      <div className="bg-card/40 backdrop-blur-sm border border-border rounded-xl p-5 space-y-4">
        <p className="text-sm font-medium text-foreground">Profilbild</p>
        
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/30 flex items-center justify-center overflow-hidden">
            {avatarUrl ? (
              <img src={avatarUrl} alt={userName ?? ''} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-medium text-foreground">
                {getInitials(userName)}
              </span>
            )}
          </div>
          
          <div>
            <Label htmlFor="avatar-upload" className="cursor-pointer">
              <Button variant="outline" size="sm" asChild>
                <span>Bild auswählen</span>
              </Button>
            </Label>
            <Input
              id="avatar-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
            <p className="text-xs text-muted-foreground mt-1">JPG, PNG oder GIF</p>
          </div>
        </div>
      </div>

      {/* Name (read-only) */}
      <div className="bg-card/40 backdrop-blur-sm border border-border rounded-xl p-5 space-y-3">
        <p className="text-sm font-medium text-foreground">Name</p>
        <p className="text-sm text-muted-foreground">{userName || 'Nicht angegeben'}</p>
      </div>

      {/* Email */}
      <div className="bg-card/40 backdrop-blur-sm border border-border rounded-xl p-5 space-y-3">
        <Label htmlFor="email" className="text-sm font-medium text-foreground">E-Mail-Adresse</Label>
        <div className="flex gap-2">
          <Input
            id="email"
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="flex-1 bg-input/50 border-border"
          />
          <Button 
            onClick={handleEmailUpdate} 
            disabled={isUpdatingEmail || newEmail === userEmail}
            size="sm"
          >
            {isUpdatingEmail ? 'Speichern...' : 'Speichern'}
          </Button>
        </div>
      </div>

      {/* Password Change */}
      <div className="bg-card/40 backdrop-blur-sm border border-border rounded-xl p-5 space-y-3">
        <p className="text-sm font-medium text-foreground">Passwort</p>
        <p className="text-xs text-muted-foreground mb-2">
          Ändere dein Passwort direkt — neues Passwort setzen und bestätigen.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleChangePassword}
        >
          Passwort ändern
        </Button>
      </div>

      {/* Referral Link for Vertriebler */}
      {userRole === 'vertriebler' && partnerCode && referralLink && (
        <div className="bg-card/40 backdrop-blur-sm border border-border rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Link className="h-4 w-4 text-primary" />
            <p className="text-sm font-medium text-foreground">Dein Empfehlungslink</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Teile diesen Link mit deinen Kunden — der Partner-Code wird automatisch zugeordnet.
          </p>
          <div className="flex gap-2">
            <Input
              readOnly
              value={referralLink}
              className="flex-1 bg-input/50 border-border text-sm"
            />
            <Button
              onClick={handleCopyLink}
              size="sm"
              variant={linkCopied ? 'default' : 'outline'}
              className="shrink-0"
            >
              {linkCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Partner-Code: <span className="font-mono font-medium text-foreground">{partnerCode}</span>
          </p>
        </div>
      )}
    </div>
  );
}
