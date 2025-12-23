import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, AlertCircle, CreditCard, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PaymentOption {
  installments: number;
  totalAmount: number;
  perInstallment: number;
  surcharge: number;
  label: string;
}

interface PaymentData {
  success: boolean;
  alreadyPaid: boolean;
  folderId?: string;
  customerName: string;
  customerEmail?: string;
  prognoseAmount?: number;
  baseFee?: number;
  paymentOptions?: PaymentOption[];
  needsConsultation?: boolean;
  error?: string;
}

const PaymentSelection = () => {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [selectedOption, setSelectedOption] = useState<PaymentOption | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPaymentOptions = async () => {
      if (!token) {
        setError("Ungültiger Zahlungslink");
        setLoading(false);
        return;
      }

      try {
        // Call the edge function with token as query parameter
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-payment-options?token=${token}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        const result = await response.json();

        if (!response.ok || result.error) {
          throw new Error(result.error || "Fehler beim Laden der Zahlungsoptionen");
        }

        setPaymentData(result);
        
        // Pre-select single payment by default
        if (result.paymentOptions && result.paymentOptions.length > 0) {
          setSelectedOption(result.paymentOptions[0]);
        }
      } catch (err) {
        console.error("Error fetching payment options:", err);
        setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten");
      } finally {
        setLoading(false);
      }
    };

    fetchPaymentOptions();
  }, [token]);

  const handlePayment = async () => {
    if (!selectedOption || !paymentData?.folderId) return;

    setProcessingPayment(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment-link`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            folderId: paymentData.folderId,
            customerName: paymentData.customerName,
            customerEmail: paymentData.customerEmail,
            prognoseAmount: paymentData.prognoseAmount,
            installmentCount: selectedOption.installments,
            installmentFee: selectedOption.surcharge,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || "Fehler beim Erstellen des Zahlungslinks");
      }

      // Redirect to Stripe Checkout
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (err) {
      console.error("Error creating payment:", err);
      toast({
        title: "Fehler",
        description: err instanceof Error ? err.message : "Ein Fehler ist aufgetreten",
        variant: "destructive",
      });
      setProcessingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Zahlungsoptionen werden geladen...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <CardTitle>Fehler</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">
              Bitte kontaktieren Sie uns, falls das Problem weiterhin besteht.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (paymentData?.alreadyPaid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <CardTitle>Bereits bezahlt</CardTitle>
            <CardDescription>
              Vielen Dank, {paymentData.customerName}! Ihre Zahlung wurde bereits erfolgreich verarbeitet.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (paymentData?.needsConsultation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <CardTitle>Individuelle Beratung erforderlich</CardTitle>
            <CardDescription>
              Aufgrund der Höhe Ihrer geschätzten Erstattung von {paymentData.prognoseAmount?.toLocaleString("de-DE")} € ist eine individuelle Beratung erforderlich.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">
              Bitte kontaktieren Sie uns für ein persönliches Gespräch.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">Zahlungsauswahl</h1>
          <p className="text-muted-foreground">
            Guten Tag, {paymentData?.customerName}! Bitte wählen Sie Ihre bevorzugte Zahlungsart.
          </p>
        </div>

        {/* Summary Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Zusammenfassung</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Geschätzte Erstattung:</span>
              <span className="font-medium">{paymentData?.prognoseAmount?.toLocaleString("de-DE")} €</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Beratungsgebühr (30%):</span>
              <span className="font-medium">{paymentData?.baseFee?.toLocaleString("de-DE")} €</span>
            </div>
          </CardContent>
        </Card>

        {/* Payment Options */}
        <div className="space-y-3 mb-6">
          <h2 className="font-semibold text-lg">Zahlungsoptionen</h2>
          
          {paymentData?.paymentOptions?.map((option) => (
            <Card
              key={option.installments}
              className={`cursor-pointer transition-all ${
                selectedOption?.installments === option.installments
                  ? "border-primary ring-2 ring-primary ring-offset-2"
                  : "hover:border-primary/50"
              }`}
              onClick={() => setSelectedOption(option)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {option.installments === 1 ? (
                      <CreditCard className="h-5 w-5 text-primary" />
                    ) : (
                      <Calendar className="h-5 w-5 text-primary" />
                    )}
                    <div>
                      <p className="font-medium">{option.label}</p>
                      {option.installments > 1 && (
                        <p className="text-sm text-muted-foreground">
                          {option.perInstallment.toLocaleString("de-DE")} € / Monat
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{option.totalAmount.toLocaleString("de-DE")} €</p>
                    {option.surcharge > 0 && (
                      <p className="text-sm text-muted-foreground">
                        +{option.surcharge} € Aufschlag
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Payment Button */}
        <Button
          className="w-full"
          size="lg"
          onClick={handlePayment}
          disabled={!selectedOption || processingPayment}
        >
          {processingPayment ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Wird verarbeitet...
            </>
          ) : (
            <>
              <CreditCard className="mr-2 h-4 w-4" />
              {selectedOption
                ? `${selectedOption.totalAmount.toLocaleString("de-DE")} € bezahlen`
                : "Zahlungsart auswählen"}
            </>
          )}
        </Button>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          Sichere Zahlung über Stripe. Ihre Daten werden verschlüsselt übertragen.
        </p>
      </div>
    </div>
  );
};

export default PaymentSelection;
