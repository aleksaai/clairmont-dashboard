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

type InstallmentOption = 'sofort' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'individuell';

// Get maximum installments based on fee amount (per Clairmont Advisory Zahlungsplan)
// Fee = 30% of refund amount
const getMaxInstallments = (feeAmount: number): number => {
  if (feeAmount >= 4500) {
    return 0; // Individuelle Beratung (Erstattung >= 15.000€)
  } else if (feeAmount >= 900) {
    return 9; // Bis zu 9 Raten (Erstattung >= 3.000€)
  } else if (feeAmount >= 300) {
    return 6; // Bis zu 6 Raten (Erstattung >= 1.000€)
  } else {
    return 2; // Bis zu 2 Raten (Erstattung < 1.000€)
  }
};

// Check if individual consultation is required (based on fee amount)
const requiresIndividualConsultation = (feeAmount: number): boolean => feeAmount >= 4500;

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
  
  // Get max installments and check if individual consultation is needed (based on fee)
  const maxInstallments = getMaxInstallments(feeAmount);
  const isIndividualConsultation = requiresIndividualConsultation(feeAmount);
  
  // Calculate installment fee: 10€ per month for installment payments
  const installmentCount = installments === 'sofort' || installments === 'individuell' ? 1 : parseInt(installments);
  const installmentFee = installments !== 'sofort' && installments !== 'individuell' ? installmentCount * 10 : 0;
  const totalFee = feeAmount + installmentFee;
  const perInstallmentAmount = installments !== 'sofort' && installments !== 'individuell' ? totalFee / installmentCount : totalFee;

  // Reset installment selection if current selection exceeds max
  useEffect(() => {
    if (parsedAmount > 0) {
      if (isIndividualConsultation && installments !== 'individuell') {
        setInstallments('individuell');
      } else if (!isIndividualConsultation && installments === 'individuell') {
        setInstallments('sofort');
      } else if (installments !== 'sofort' && installments !== 'individuell') {
        const selectedCount = parseInt(installments);
        if (selectedCount > maxInstallments) {
          setInstallments('sofort');
        }
      }
    }
  }, [parsedAmount, maxInstallments, isIndividualConsultation, installments]);

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
            <Select 
              value={installments} 
              onValueChange={(v) => setInstallments(v as InstallmentOption)}
              disabled={isIndividualConsultation}
            >
              <SelectTrigger className="bg-input/50 border-border">
                <SelectValue placeholder="Zahlungsart wählen" />
              </SelectTrigger>
              <SelectContent>
                {!isIndividualConsultation && (
                  <>
                    <SelectItem value="sofort">Sofortzahlung</SelectItem>
                    {maxInstallments >= 2 && (
                      <SelectItem value="2">2 Raten (+20€ Aufschlag)</SelectItem>
                    )}
                    {maxInstallments >= 3 && (
                      <SelectItem value="3">3 Raten (+30€ Aufschlag)</SelectItem>
                    )}
                    {maxInstallments >= 4 && (
                      <SelectItem value="4">4 Raten (+40€ Aufschlag)</SelectItem>
                    )}
                    {maxInstallments >= 5 && (
                      <SelectItem value="5">5 Raten (+50€ Aufschlag)</SelectItem>
                    )}
                    {maxInstallments >= 6 && (
                      <SelectItem value="6">6 Raten (+60€ Aufschlag)</SelectItem>
                    )}
                    {maxInstallments >= 7 && (
                      <SelectItem value="7">7 Raten (+70€ Aufschlag)</SelectItem>
                    )}
                    {maxInstallments >= 8 && (
                      <SelectItem value="8">8 Raten (+80€ Aufschlag)</SelectItem>
                    )}
                    {maxInstallments >= 9 && (
                      <SelectItem value="9">9 Raten (+90€ Aufschlag)</SelectItem>
                    )}
                  </>
                )}
                {isIndividualConsultation && (
                  <SelectItem value="individuell">Individuelle Beratung erforderlich</SelectItem>
                )}
              </SelectContent>
            </Select>
            {parsedAmount > 0 && parsedAmount < 1000 && (
              <p className="text-xs text-muted-foreground">
                Bis 1.000 € Erstattung: Sofortzahlung oder max. 2 Raten
              </p>
            )}
            {parsedAmount >= 1000 && parsedAmount < 3000 && (
              <p className="text-xs text-muted-foreground">
                1.000 € – 3.000 € Erstattung: Bis zu 6 Raten möglich
              </p>
            )}
            {parsedAmount >= 3000 && parsedAmount < 15000 && (
              <p className="text-xs text-muted-foreground">
                3.000 € – 15.000 € Erstattung: Bis zu 9 Raten möglich
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
                  Bei einer Gebühr ab 4.500 € (Erstattung ab 15.000 €) ist eine individuelle Zahlungsvereinbarung notwendig. 
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
