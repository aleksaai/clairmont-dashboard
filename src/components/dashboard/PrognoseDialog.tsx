import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Calculator, Loader2, Euro } from 'lucide-react';

interface PrognoseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  folderId: string;
  customerName: string;
  currentPrognose?: number | null;
  onPrognoseUpdated: (amount: number) => void;
}

export function PrognoseDialog({ 
  isOpen, 
  onClose, 
  folderId, 
  customerName, 
  currentPrognose,
  onPrognoseUpdated 
}: PrognoseDialogProps) {
  const { toast } = useToast();
  const [amount, setAmount] = useState(currentPrognose?.toString() || '');
  const [isSaving, setIsSaving] = useState(false);

  const parsedAmount = parseFloat(amount.replace(',', '.')) || 0;
  const feeAmount = parsedAmount * 0.30;

  const handleSave = async () => {
    if (parsedAmount <= 0) {
      toast({
        title: 'Ungültiger Betrag',
        description: 'Bitte gib einen gültigen Betrag ein.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('folders')
        .update({
          prognose_amount: parsedAmount,
          prognose_created_at: new Date().toISOString(),
          status: 'prognose_erstellt',
        })
        .eq('id', folderId);

      if (error) throw error;

      toast({
        title: 'Prognose gespeichert',
        description: `Prognose von ${parsedAmount.toFixed(2)} € wurde gespeichert.`,
      });
      
      onPrognoseUpdated(parsedAmount);
      handleClose();
    } catch (error) {
      console.error('Error saving prognose:', error);
      toast({
        title: 'Fehler',
        description: 'Die Prognose konnte nicht gespeichert werden.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setAmount(currentPrognose?.toString() || '');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            Prognose für {customerName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="prognose-amount">Geschätzte Steuererstattung</Label>
            <div className="relative">
              <Euro className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="prognose-amount"
                type="text"
                placeholder="z.B. 1000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-input/50 border-border pl-10 text-lg"
                autoFocus
              />
            </div>
          </div>

          {/* Fee Calculation Display */}
          {parsedAmount > 0 && (
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Geschätzte Erstattung:</span>
                <span className="font-medium">{parsedAmount.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Beratungsgebühr (30%):</span>
                <span className="font-semibold text-primary">{feeAmount.toFixed(2)} €</span>
              </div>
              <div className="border-t border-primary/20 pt-2 mt-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Netto für Kunden:</span>
                  <span className="font-medium">{(parsedAmount - feeAmount).toFixed(2)} €</span>
                </div>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Die Gebühr von 30% wird dem Kunden als Zahlungslink gesendet.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Abbrechen
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving || parsedAmount <= 0}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Speichern...
              </>
            ) : (
              'Prognose speichern'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
