import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Mail, Wand2, Loader2, Send } from 'lucide-react';

interface EmailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  customerName: string;
  customerEmail: string | null;
  productType?: string;
  folderName?: string;
  isOfferMode?: boolean;
  prognoseAmount?: number | null;
  paymentLinkUrl?: string | null;
}

export function EmailDialog({ 
  isOpen, 
  onClose, 
  customerName, 
  customerEmail, 
  productType, 
  folderName,
  isOfferMode = false,
  prognoseAmount,
  paymentLinkUrl,
}: EmailDialogProps) {
  const { toast } = useToast();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Auto-generate offer email when in offer mode
  const handleGenerateOfferEmail = async () => {
    if (!prognoseAmount || !paymentLinkUrl) return;
    
    const feeAmount = prognoseAmount * 0.30;
    const offerPrompt = `Erstelle ein Angebot für den Kunden. Die Prognose für die Steuererstattung beträgt ${prognoseAmount.toFixed(2)} €. Die Beratungsgebühr beträgt ${feeAmount.toFixed(2)} € (30% der Erstattung). Füge einen Hinweis ein, dass der Kunde über den folgenden Link bezahlen kann: ${paymentLinkUrl}`;
    
    setAiPrompt(offerPrompt);
    
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-email', {
        body: {
          prompt: offerPrompt,
          customerName,
          customerEmail: customerEmail || '',
          productType: productType || null,
          folderName: folderName || null,
          isOffer: true,
          prognoseAmount,
          feeAmount,
          paymentLinkUrl,
        },
      });

      if (error) throw error;

      if (data?.message) {
        setMessage(data.message);
        if (data?.subject) {
          setSubject(data.subject);
        }
        toast({
          title: 'Angebots-E-Mail generiert',
          description: 'Du kannst das Angebot noch anpassen bevor du es sendest.',
        });
      }
    } catch (error) {
      console.error('Error generating offer email:', error);
      toast({
        title: 'Fehler',
        description: 'Das Angebot konnte nicht generiert werden.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Auto-generate on open in offer mode
  useState(() => {
    if (isOfferMode && prognoseAmount && paymentLinkUrl && !message) {
      handleGenerateOfferEmail();
    }
  });

  const handleGenerateEmail = async () => {
    if (!aiPrompt.trim()) {
      toast({
        title: 'Prompt erforderlich',
        description: 'Bitte beschreibe, was in der E-Mail stehen soll.',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-email', {
        body: {
          prompt: aiPrompt,
          customerName,
          customerEmail: customerEmail || '',
          productType: productType || null,
          folderName: folderName || null,
        },
      });

      if (error) throw error;

      if (data?.message) {
        setMessage(data.message);
        if (data?.subject) {
          setSubject(data.subject);
        }
        toast({
          title: 'E-Mail generiert',
          description: 'Die KI hat Betreff und Nachricht erstellt. Du kannst sie noch anpassen.',
        });
      }
    } catch (error) {
      console.error('Error generating email:', error);
      toast({
        title: 'Fehler',
        description: 'Die E-Mail konnte nicht generiert werden.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendEmail = async () => {
    if (!customerEmail) {
      toast({
        title: 'Keine E-Mail-Adresse',
        description: 'Für diesen Kunden ist keine E-Mail-Adresse hinterlegt.',
        variant: 'destructive',
      });
      return;
    }

    if (!subject.trim() || !message.trim()) {
      toast({
        title: 'Felder ausfüllen',
        description: 'Bitte fülle Betreff und Nachricht aus.',
        variant: 'destructive',
      });
      return;
    }

    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          to: customerEmail,
          subject,
          message,
          customerName,
        },
      });

      if (error) throw error;

      toast({
        title: 'E-Mail gesendet',
        description: `Die E-Mail wurde erfolgreich an ${customerEmail} gesendet.`,
      });
      
      // Reset and close
      setSubject('');
      setMessage('');
      setAiPrompt('');
      onClose();
    } catch (error) {
      console.error('Error sending email:', error);
      toast({
        title: 'Fehler',
        description: 'Die E-Mail konnte nicht gesendet werden.',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    setSubject('');
    setMessage('');
    setAiPrompt('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            E-Mail an {customerName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Recipient info */}
          <div className="bg-muted/30 rounded-lg p-3 text-sm">
            <p><span className="text-muted-foreground">An:</span> {customerEmail || 'Keine E-Mail-Adresse hinterlegt'}</p>
          </div>

          {/* AI Helper */}
          <div className="space-y-2 border border-border rounded-lg p-4 bg-muted/10">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Wand2 className="w-4 h-4 text-primary" />
              KI-Assistent
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder="z.B. Bitte um fehlende Unterlagen für die Steuererklärung"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                className="bg-input/50 border-border"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleGenerateEmail();
                  }
                }}
              />
              <Button 
                onClick={handleGenerateEmail} 
                disabled={isGenerating || !aiPrompt.trim()}
                variant="secondary"
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Wand2 className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Beschreibe kurz, worum es in der E-Mail gehen soll
            </p>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="email-subject">Betreff</Label>
            <Input
              id="email-subject"
              placeholder="Betreff der E-Mail"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="bg-input/50 border-border"
            />
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="email-message">Nachricht</Label>
            <Textarea
              id="email-message"
              placeholder="Ihre Nachricht..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="bg-input/50 border-border min-h-[200px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Abbrechen
          </Button>
          <Button 
            onClick={handleSendEmail} 
            disabled={isSending || !customerEmail || !subject.trim() || !message.trim()}
          >
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Senden...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                E-Mail senden
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
