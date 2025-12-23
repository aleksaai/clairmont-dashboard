import { useState, useEffect } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Calculator, Loader2, Euro, AlertTriangle } from 'lucide-react';

interface PrognoseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  folderId: string;
  customerName: string;
  currentPrognose?: number | null;
  currentInstallments?: number | null;
  onPrognoseUpdated: (amount: number, installmentCount: number, installmentFee: number) => void;
}

type InstallmentOption = 'sofort' | '2' | '3' | '6' | '9' | 'individuell';

// Get available installment options based on amount (per Clairmont Advisory Zahlungsplan)
const getAvailableInstallmentOptions = (amount: number): InstallmentOption[] => {
  if (amount >= 4500) {
    // Ab 4.500 €: Individuelle Beratung
    return ['sofort', 'individuell'];
  } else if (amount >= 3000) {
    // 3.000 € – 4.500 €: Bis zu 9 Raten
    return ['sofort', '2', '3', '6', '9'];
  } else if (amount >= 1000) {
    // 1.000 € – 3.000 €: Bis zu 6 Raten
    return ['sofort', '2', '3', '6'];
  } else {
    // Bis 1.000 €: Nur Sofortzahlung oder 2 Raten
    return ['sofort', '2'];
  }
};

export function PrognoseDialog({ 
  isOpen, 
  onClose, 
  folderId, 
  customerName, 
  currentPrognose,
  currentInstallments,
  onPrognoseUpdated 
}: PrognoseDialogProps) {
  const { toast } = useToast();
  const [amount, setAmount] = useState(currentPrognose?.toString() || '');
  const getInitialInstallments = (): InstallmentOption => {
    if (!currentInstallments || currentInstallments === 1) return 'sofort';
    if (currentInstallments === 9) return '9';
    return currentInstallments.toString() as InstallmentOption;
  };
  const [installments, setInstallments] = useState<InstallmentOption>(getInitialInstallments());
  const [isSaving, setIsSaving] = useState(false);

  const parsedAmount = parseFloat(amount.replace(',', '.')) || 0;
  const feeAmount = parsedAmount * 0.30;
  
  // Get available options based on amount
  const availableOptions = getAvailableInstallmentOptions(parsedAmount);
  const isIndividualConsultation = installments === 'individuell';
  
  // Calculate installment fee: 10€ per month for installment payments
  const installmentCount = installments === 'sofort' || installments === 'individuell' ? 1 : parseInt(installments);
  const installmentFee = installments !== 'sofort' && installments !== 'individuell' ? installmentCount * 10 : 0;
  const totalFee = feeAmount + installmentFee;
  const perInstallmentAmount = installments !== 'sofort' && installments !== 'individuell' ? totalFee / installmentCount : totalFee;

  // Reset installment selection if current selection is no longer available
  useEffect(() => {
    if (parsedAmount > 0 && !availableOptions.includes(installments)) {
      setInstallments('sofort');
    }
  }, [parsedAmount, availableOptions, installments]);

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
          installment_count: installmentCount,
          installment_fee: installmentFee,
        })
        .eq('id', folderId);

      if (error) throw error;

      toast({
        title: 'Prognose gespeichert',
        description: `Prognose von ${parsedAmount.toFixed(2)} € wurde gespeichert.`,
      });
      
      onPrognoseUpdated(parsedAmount, installmentCount, installmentFee);
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
    setInstallments('sofort');
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

          {/* Installment Selection */}
          <div className="space-y-2">
            <Label htmlFor="installments">Zahlungsart</Label>
            <Select value={installments} onValueChange={(v) => setInstallments(v as InstallmentOption)}>
              <SelectTrigger className="bg-input/50 border-border">
                <SelectValue placeholder="Zahlungsart wählen" />
              </SelectTrigger>
              <SelectContent>
                {availableOptions.includes('sofort') && (
                  <SelectItem value="sofort">Sofortzahlung</SelectItem>
                )}
                {availableOptions.includes('2') && (
                  <SelectItem value="2">2 Raten (+20€ Aufschlag)</SelectItem>
                )}
                {availableOptions.includes('3') && (
                  <SelectItem value="3">3 Raten (+30€ Aufschlag)</SelectItem>
                )}
                {availableOptions.includes('6') && (
                  <SelectItem value="6">6 Raten (+60€ Aufschlag)</SelectItem>
                )}
                {availableOptions.includes('9') && (
                  <SelectItem value="9">9 Raten (+90€ Aufschlag)</SelectItem>
                )}
                {availableOptions.includes('individuell') && (
                  <SelectItem value="individuell">Individuelle Beratung erforderlich</SelectItem>
                )}
              </SelectContent>
            </Select>
            {parsedAmount > 0 && parsedAmount < 1000 && (
              <p className="text-xs text-muted-foreground">
                Bis 1.000 €: Sofortzahlung oder max. 2 Raten
              </p>
            )}
            {parsedAmount >= 1000 && parsedAmount < 3000 && (
              <p className="text-xs text-muted-foreground">
                1.000 € – 3.000 €: Bis zu 6 Raten möglich
              </p>
            )}
            {parsedAmount >= 3000 && parsedAmount < 4500 && (
              <p className="text-xs text-muted-foreground">
                3.000 € – 4.500 €: Bis zu 9 Raten möglich
              </p>
            )}
          </div>

          {/* Warning for individual consultation */}
          {isIndividualConsultation && (
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-warning">Individuelle Beratung erforderlich</p>
                <p className="text-muted-foreground mt-1">
                  Bei Beträgen ab 4.500 € ist eine individuelle Zahlungsvereinbarung notwendig. 
                  Bitte kontaktieren Sie den Kunden direkt.
                </p>
              </div>
            </div>
          )}

          {/* Fee Calculation Display */}
          {parsedAmount > 0 && !isIndividualConsultation && (
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Geschätzte Erstattung:</span>
                <span className="font-medium">{parsedAmount.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Beratungsgebühr (30%):</span>
                <span className="font-medium">{feeAmount.toFixed(2)} €</span>
              </div>
              {installments !== 'sofort' && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Ratenaufschlag ({installmentCount}x 10€):</span>
                  <span className="font-medium">{installmentFee.toFixed(2)} €</span>
                </div>
              )}
              <div className="border-t border-primary/20 pt-2 mt-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Gesamtgebühr:</span>
                  <span className="font-semibold text-primary">{totalFee.toFixed(2)} €</span>
                </div>
                {installments !== 'sofort' && (
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-muted-foreground">Pro Rate:</span>
                    <span className="font-medium">{perInstallmentAmount.toFixed(2)} € × {installmentCount}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-muted-foreground">Netto für Kunden:</span>
                  <span className="font-medium">{(parsedAmount - totalFee).toFixed(2)} €</span>
                </div>
              </div>
            </div>
          )}

          {!isIndividualConsultation && (
            <p className="text-xs text-muted-foreground">
              {installments === 'sofort' 
                ? 'Die Gebühr wird dem Kunden als einmaliger Zahlungslink gesendet.'
                : `Der Kunde erhält ${installmentCount} monatliche Zahlungsaufforderungen.`
              }
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Abbrechen
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving || parsedAmount <= 0 || isIndividualConsultation}
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
