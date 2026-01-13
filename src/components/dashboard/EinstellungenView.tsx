import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/hooks/useLanguage';
import { Language } from '@/i18n/translations';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface EinstellungenViewProps {
  userName: string | null;
  userEmail: string | undefined;
  avatarUrl?: string | null;
  userId: string | undefined;
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

export function EinstellungenView({ userName, userEmail, avatarUrl, userId, onProfileUpdate }: EinstellungenViewProps) {
  const { toast } = useToast();
  const { language, setLanguage, t } = useLanguage();
  const [newEmail, setNewEmail] = useState(userEmail || '');
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isUpdatingLanguage, setIsUpdatingLanguage] = useState(false);

  const handleEmailUpdate = async () => {
    if (!newEmail || newEmail === userEmail) return;
    
    setIsUpdatingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      
      if (error) throw error;
      
      toast({
        title: t('settingsEmailChangeRequested'),
        description: t('settingsEmailChangeDescription'),
      });
    } catch (error: any) {
      toast({
        title: t('error'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  const handleLanguageChange = async (newLang: Language) => {
    setIsUpdatingLanguage(true);
    try {
      await setLanguage(newLang);
      toast({
        title: t('settingsLanguageUpdated'),
        description: t('settingsLanguageUpdatedDesc'),
      });
    } catch (error: any) {
      toast({
        title: t('error'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingLanguage(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!userEmail) return;
    
    setIsResettingPassword(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
        redirectTo: `${window.location.origin}/auth`,
      });
      
      if (error) throw error;
      
      toast({
        title: t('settingsEmailSent'),
        description: t('settingsPasswordResetEmailSent'),
      });
    } catch (error: any) {
      toast({
        title: t('error'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsResettingPassword(false);
    }
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
        title: t('settingsProfilePictureUpdated'),
        description: t('settingsProfilePictureUpdatedDesc'),
      });

      onProfileUpdate?.();
    } catch (error: any) {
      toast({
        title: t('settingsUploadError'),
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      <h2 className="text-lg font-semibold text-foreground">{t('settingsTitle')}</h2>
      
      {/* Language Selection */}
      <div className="bg-card/40 backdrop-blur-sm border border-border rounded-xl p-5 space-y-3">
        <p className="text-sm font-medium text-foreground">{t('settingsLanguage')}</p>
        <p className="text-xs text-muted-foreground mb-2">
          {t('settingsLanguageDescription')}
        </p>
        <Select 
          value={language} 
          onValueChange={(value) => handleLanguageChange(value as Language)}
          disabled={isUpdatingLanguage}
        >
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="de">🇩🇪 {t('settingsLanguageGerman')}</SelectItem>
            <SelectItem value="en">🇬🇧 {t('settingsLanguageEnglish')}</SelectItem>
            <SelectItem value="tr">🇹🇷 {t('settingsLanguageTurkish')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Profile Picture */}
      <div className="bg-card/40 backdrop-blur-sm border border-border rounded-xl p-5 space-y-4">
        <p className="text-sm font-medium text-foreground">{t('settingsProfilePicture')}</p>
        
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
                <span>{t('settingsSelectImage')}</span>
              </Button>
            </Label>
            <Input
              id="avatar-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
            <p className="text-xs text-muted-foreground mt-1">{t('settingsImageFormats')}</p>
          </div>
        </div>
      </div>

      {/* Name (read-only) */}
      <div className="bg-card/40 backdrop-blur-sm border border-border rounded-xl p-5 space-y-3">
        <p className="text-sm font-medium text-foreground">{t('settingsName')}</p>
        <p className="text-sm text-muted-foreground">{userName || t('settingsNotSpecified')}</p>
      </div>

      {/* Email */}
      <div className="bg-card/40 backdrop-blur-sm border border-border rounded-xl p-5 space-y-3">
        <Label htmlFor="email" className="text-sm font-medium text-foreground">{t('settingsEmail')}</Label>
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
            {isUpdatingEmail ? t('saving') : t('save')}
          </Button>
        </div>
      </div>

      {/* Password Reset */}
      <div className="bg-card/40 backdrop-blur-sm border border-border rounded-xl p-5 space-y-3">
        <p className="text-sm font-medium text-foreground">{t('settingsPassword')}</p>
        <p className="text-xs text-muted-foreground mb-2">
          {t('settingsPasswordResetInfo')}
        </p>
        <Button 
          variant="outline" 
          size="sm"
          onClick={handlePasswordReset}
          disabled={isResettingPassword}
        >
          {isResettingPassword ? t('settingsPasswordResetSending') : t('settingsPasswordReset')}
        </Button>
      </div>
    </div>
  );
}
