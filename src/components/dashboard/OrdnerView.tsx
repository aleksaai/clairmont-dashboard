import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Plus, Upload, FileText, ChevronRight, Folder, Image, FileSpreadsheet, FileType, File, FileVideo, FileAudio, FileArchive, FileCode, Presentation, Mail, Calculator, Send, Loader2, Copy, ExternalLink, Trash2, Pencil, Check, X } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/useAuth';
import { EmailDialog } from './EmailDialog';
import { PrognoseDialog } from './PrognoseDialog';

// Include all database enum values for type compatibility, but only show relevant ones in UI
type CaseStatus = 'neu' | 'bezahlt' | 'in_bearbeitung' | 'abgeschlossen' | 'einspruch' | 'anfrage_eingegangen' | 'prognose_erstellt' | 'angebot_gesendet' | 'anzahlung_erhalten' | 'einspruch_nacharbeit' | 'rueckstand';
type ProductType = 'steuern' | 'kredit' | 'versicherung' | 'problemfall';

interface FolderData {
  id: string;
  name: string;
  customer_name: string;
  customer_email: string | null;
  status: CaseStatus;
  product: ProductType;
  partner_code: string | null;
  created_at: string;
  prognose_amount: number | null;
  prognose_created_at: string | null;
  payment_link_url: string | null;
  payment_status: string | null;
  installment_count: number | null;
  installment_fee: number | null;
  installments_paid: number | null;
  next_payment_date: string | null;
}

interface Document {
  id: string;
  name: string;
  file_path: string;
  file_type: string | null;
  created_at: string;
}

// Status options per product
const productStatuses: Record<ProductType, CaseStatus[]> = {
  steuern: ['anfrage_eingegangen', 'prognose_erstellt', 'angebot_gesendet', 'anzahlung_erhalten', 'rueckstand', 'bezahlt', 'einspruch_nacharbeit'],
  kredit: ['neu', 'anzahlung_erhalten', 'rueckstand', 'bezahlt', 'einspruch'],
  versicherung: ['neu', 'anzahlung_erhalten', 'rueckstand', 'bezahlt', 'einspruch'],
  problemfall: ['neu', 'abgeschlossen'],
};

const statusLabels: Record<CaseStatus, string> = {
  neu: 'Neu / Anfrage',
  bezahlt: 'Bezahlt',
  in_bearbeitung: 'In Bearbeitung',
  abgeschlossen: 'Abgeschlossen',
  einspruch: 'Einspruch',
  anfrage_eingegangen: 'Anfrage eingegangen',
  prognose_erstellt: 'Prognose erstellt',
  angebot_gesendet: 'Angebot gesendet',
  anzahlung_erhalten: 'Anzahlung erhalten',
  rueckstand: 'Rückstand',
  einspruch_nacharbeit: 'Einspruch / Nacharbeit',
};

const productConfig: Record<ProductType, { label: string; color: string; bgColor: string }> = {
  steuern: { 
    label: 'Steuerfälle', 
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20 border-blue-500/30'
  },
  versicherung: { 
    label: 'Baufinanzierungsfälle', 
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20 border-emerald-500/30'
  },
  kredit: { 
    label: 'Kreditfälle', 
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20 border-yellow-500/30'
  },
  problemfall: { 
    label: 'Problemfälle', 
    color: 'text-red-400',
    bgColor: 'bg-red-500/20 border-red-500/30'
  },
};

const allProducts: ProductType[] = ['steuern', 'versicherung', 'kredit', 'problemfall'];

// Get context-dependent status label (for Problemfälle)
const getStatusLabel = (status: CaseStatus, product?: ProductType): string => {
  if (product === 'problemfall') {
    if (status === 'neu') return 'Offen';
    if (status === 'abgeschlossen') return 'Erledigt';
  }
  return statusLabels[status];
};

// Get icon based on file type
const getFileIcon = (fileType: string | null) => {
  const type = fileType?.toLowerCase() || '';
  
  // Images
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(type)) {
    return { Icon: Image, color: 'text-green-500' };
  }
  // PDF
  if (type === 'pdf') {
    return { Icon: FileText, color: 'text-red-500' };
  }
  // Word documents
  if (['doc', 'docx', 'odt', 'rtf'].includes(type)) {
    return { Icon: FileType, color: 'text-blue-500' };
  }
  // Spreadsheets
  if (['xls', 'xlsx', 'csv', 'ods'].includes(type)) {
    return { Icon: FileSpreadsheet, color: 'text-emerald-500' };
  }
  // Presentations
  if (['ppt', 'pptx', 'odp'].includes(type)) {
    return { Icon: Presentation, color: 'text-orange-500' };
  }
  // Video
  if (['mp4', 'avi', 'mov', 'mkv', 'webm', 'wmv'].includes(type)) {
    return { Icon: FileVideo, color: 'text-purple-500' };
  }
  // Audio
  if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'].includes(type)) {
    return { Icon: FileAudio, color: 'text-pink-500' };
  }
  // Archives
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(type)) {
    return { Icon: FileArchive, color: 'text-yellow-500' };
  }
  // Code files
  if (['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'json', 'xml', 'py', 'java', 'php'].includes(type)) {
    return { Icon: FileCode, color: 'text-cyan-500' };
  }
  // Default
  return { Icon: File, color: 'text-muted-foreground' };
};

export function OrdnerView() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  
  // Navigation state
  const [selectedProduct, setSelectedProduct] = useState<ProductType | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<CaseStatus | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<FolderData | null>(null);
  
  // Data state
  const [folders, setFolders] = useState<FolderData[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isEmailOpen, setIsEmailOpen] = useState(false);
  const [isPrognoseOpen, setIsPrognoseOpen] = useState(false);
  const [isOfferMode, setIsOfferMode] = useState(false);
  const [isGeneratingPaymentLink, setIsGeneratingPaymentLink] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<FolderData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditingPartnerCode, setIsEditingPartnerCode] = useState(false);
  const [editPartnerCode, setEditPartnerCode] = useState('');
  
  // Form state
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [partnerCode, setPartnerCode] = useState('');

  useEffect(() => {
    fetchFolders();
  }, []);

  useEffect(() => {
    if (selectedFolder) {
      fetchDocuments(selectedFolder.id);
    }
  }, [selectedFolder]);

  const fetchFolders = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    } else {
      setFolders(data || []);
    }
    setIsLoading(false);
  };

  const fetchDocuments = async (folderId: string) => {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('folder_id', folderId)
      .order('created_at', { ascending: false });

    if (!error) {
      setDocuments(data || []);
    }
  };

  const createFolder = async () => {
    if (!customerName.trim() || !user?.id || !selectedProduct || !selectedStatus) return;

    const date = new Date().toLocaleDateString('de-DE');
    const folderName = `${customerName} - ${date}`;

    const { error } = await supabase.from('folders').insert({
      name: folderName,
      customer_name: customerName,
      customer_email: customerEmail || null,
      product: selectedProduct,
      status: selectedStatus,
      partner_code: partnerCode || null,
      created_by: user.id,
    });

    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Ordner erstellt', description: folderName });
      setIsCreateOpen(false);
      setCustomerName('');
      setCustomerEmail('');
      setPartnerCode('');
      fetchFolders();
    }
  };

  const updateStatus = async (folderId: string, newStatus: CaseStatus) => {
    const { error } = await supabase
      .from('folders')
      .update({ status: newStatus })
      .eq('id', folderId);

    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    } else {
      fetchFolders();
      if (selectedFolder?.id === folderId) {
        setSelectedFolder({ ...selectedFolder, status: newStatus });
      }
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || !selectedFolder || !user?.id) return;

    setIsUploading(true);

    for (const file of Array.from(files)) {
      const fileExt = file.name.split('.').pop();
      const filePath = `${selectedFolder.id}/${Date.now()}_${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) {
        toast({ title: 'Upload-Fehler', description: uploadError.message, variant: 'destructive' });
        continue;
      }

      const { error: dbError } = await supabase.from('documents').insert({
        folder_id: selectedFolder.id,
        name: file.name,
        file_path: filePath,
        file_type: fileExt || null,
        file_size: file.size,
        uploaded_by: user.id,
      });

      if (dbError) {
        toast({ title: 'Fehler', description: dbError.message, variant: 'destructive' });
      }
    }

    setIsUploading(false);
    fetchDocuments(selectedFolder.id);
    toast({ title: 'Dokumente hochgeladen' });
  };

  const downloadDocument = async (doc: Document) => {
    const { data, error } = await supabase.storage
      .from('documents')
      .download(doc.file_path);

    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const deleteFolder = async (folder: FolderData) => {
    if (role !== 'admin') {
      toast({ title: 'Keine Berechtigung', description: 'Nur Administratoren können Ordner löschen.', variant: 'destructive' });
      return;
    }

    setIsDeleting(true);
    try {
      // First delete all documents in the folder from storage
      const { data: docsToDelete } = await supabase
        .from('documents')
        .select('file_path')
        .eq('folder_id', folder.id);

      if (docsToDelete && docsToDelete.length > 0) {
        const filePaths = docsToDelete.map(d => d.file_path);
        await supabase.storage.from('documents').remove(filePaths);
      }

      // Delete documents from database
      const { error: docsError } = await supabase
        .from('documents')
        .delete()
        .eq('folder_id', folder.id);

      if (docsError) throw docsError;

      // Delete the folder
      const { error: folderError } = await supabase
        .from('folders')
        .delete()
        .eq('id', folder.id);

      if (folderError) throw folderError;

      toast({ title: 'Ordner gelöscht', description: `"${folder.customer_name}" wurde erfolgreich gelöscht.` });
      
      // Reset view if we deleted the currently selected folder
      if (selectedFolder?.id === folder.id) {
        setSelectedFolder(null);
        setDocuments([]);
      }
      
      fetchFolders();
    } catch (error: any) {
      console.error('Error deleting folder:', error);
      toast({ title: 'Fehler', description: error.message || 'Ordner konnte nicht gelöscht werden.', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
      setFolderToDelete(null);
    }
  };

  const handlePrognoseUpdated = (amount: number, installmentCount: number, installmentFee: number) => {
    if (selectedFolder) {
      setSelectedFolder({ 
        ...selectedFolder, 
        prognose_amount: amount,
        prognose_created_at: new Date().toISOString(),
        status: 'prognose_erstellt',
        installment_count: installmentCount,
        installment_fee: installmentFee,
      });
      fetchFolders();
    }
  };

  const handleSendOffer = async () => {
    if (!selectedFolder?.prognose_amount || !selectedFolder?.customer_email) {
      toast({
        title: 'Fehler',
        description: selectedFolder?.customer_email 
          ? 'Bitte erstelle zuerst eine Prognose.' 
          : 'Keine E-Mail-Adresse hinterlegt.',
        variant: 'destructive',
      });
      return;
    }

    setIsGeneratingPaymentLink(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-payment-link', {
        body: {
          folderId: selectedFolder.id,
          customerName: selectedFolder.customer_name,
          customerEmail: selectedFolder.customer_email,
          prognoseAmount: selectedFolder.prognose_amount,
          installmentCount: selectedFolder.installment_count || 1,
          installmentFee: selectedFolder.installment_fee || 0,
        },
      });

      if (error) throw error;

      // Update local state with payment info
      setSelectedFolder({
        ...selectedFolder,
        payment_link_url: data.url,
        payment_status: 'pending',
        status: 'angebot_gesendet',
      });

      // Open email dialog in offer mode
      setIsOfferMode(true);
      setIsEmailOpen(true);
      
      const installmentInfo = data.installmentCount > 1 
        ? ` (${data.installmentCount} Raten)` 
        : '';
      toast({
        title: 'Zahlungslink erstellt',
        description: `Gesamtgebühr: ${data.totalFee.toFixed(2)} €${installmentInfo}`,
      });
      
      fetchFolders();
    } catch (error) {
      console.error('Error creating payment link:', error);
      toast({
        title: 'Fehler',
        description: 'Der Zahlungslink konnte nicht erstellt werden.',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingPaymentLink(false);
    }
  };

  const handleEmailSent = async (wasOfferEmail: boolean) => {
    // Update status to "angebot_gesendet" when an offer email is sent
    if (wasOfferEmail && selectedFolder && selectedFolder.status === 'prognose_erstellt') {
      const { error } = await supabase
        .from('folders')
        .update({ status: 'angebot_gesendet' })
        .eq('id', selectedFolder.id);
      
      if (!error) {
        setSelectedFolder({ ...selectedFolder, status: 'angebot_gesendet' });
        fetchFolders();
      }
    }
  };

  const goBack = () => {
    if (selectedFolder) {
      setSelectedFolder(null);
      setDocuments([]);
    } else if (selectedStatus) {
      setSelectedStatus(null);
    } else if (selectedProduct) {
      setSelectedProduct(null);
    }
  };

  // Get breadcrumb path
  const getBreadcrumb = () => {
    const parts: string[] = ['Drive'];
    if (selectedProduct) parts.push(productConfig[selectedProduct].label);
    if (selectedStatus && selectedProduct) parts.push(getStatusLabel(selectedStatus, selectedProduct));
    if (selectedFolder) parts.push(selectedFolder.customer_name);
    return parts;
  };

  // Filter folders by selected product and status
  const filteredFolders = folders.filter(f => 
    f.product === selectedProduct && f.status === selectedStatus
  );

  // Count folders per status for current product
  const getStatusCount = (status: CaseStatus) => {
    return folders.filter(f => f.product === selectedProduct && f.status === status).length;
  };

  // Count folders per product
  const getProductCount = (product: ProductType) => {
    return folders.filter(f => f.product === product).length;
  };

  // Render breadcrumb navigation
  const renderBreadcrumb = () => {
    const handleBreadcrumbClick = (index: number) => {
      if (index === 0) {
        // "Drive" - zurück zur Produktauswahl
        setSelectedProduct(null);
        setSelectedStatus(null);
        setSelectedFolder(null);
        setDocuments([]);
      } else if (index === 1 && selectedProduct) {
        // Produkt (z.B. "Steuerfälle") - zurück zur Status-Liste
        setSelectedStatus(null);
        setSelectedFolder(null);
        setDocuments([]);
      } else if (index === 2 && selectedStatus) {
        // Status - zurück zur Kundenordner-Liste
        setSelectedFolder(null);
        setDocuments([]);
      }
    };

    const parts = getBreadcrumb();
    return (
      <div className="flex items-center gap-2 text-sm">
        {parts.map((part, index) => {
          const isLast = index === parts.length - 1;
          const isClickable = !isLast;
          return (
            <div key={index} className="flex items-center gap-2">
              {index > 0 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
              <span 
                onClick={() => isClickable && handleBreadcrumbClick(index)}
                className={`${isLast ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground cursor-pointer transition-colors'}`}
              >
                {part}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  // EBENE 4: Dokumente im Kundenordner
  if (selectedFolder) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto">
            <Button variant="ghost" size="sm" onClick={goBack} className="shrink-0">
              ← Zurück
            </Button>
            <div className="text-sm truncate">
              {renderBreadcrumb()}
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {/* Prognose Button - only for Steuern */}
            {selectedFolder.product === 'steuern' && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setIsPrognoseOpen(true)}
                className="border-border"
              >
                <Calculator className="w-4 h-4 mr-1 md:mr-2" />
                <span className="hidden sm:inline">Prognose</span>
              </Button>
            )}

            {/* Angebot senden Button - only if prognose exists */}
            {selectedFolder.product === 'steuern' && selectedFolder.prognose_amount && (
              <Button 
                variant="default" 
                size="sm"
                onClick={handleSendOffer}
                disabled={isGeneratingPaymentLink || !selectedFolder.customer_email}
                className="bg-primary"
              >
                {isGeneratingPaymentLink ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-1 md:mr-2" />
                    <span className="hidden sm:inline">Angebot</span>
                  </>
                )}
              </Button>
            )}

            {/* Payment link actions */}
            {selectedFolder.payment_link_url && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border"
                  onClick={() => window.open(selectedFolder.payment_link_url!, '_blank', 'noopener,noreferrer')}
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(selectedFolder.payment_link_url!);
                      toast({ title: 'Zahlungslink kopiert' });
                    } catch (e) {
                      toast({
                        title: 'Fehler',
                        description: 'Kopieren nicht möglich.',
                        variant: 'destructive',
                      });
                    }
                  }}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </>
            )}
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setIsOfferMode(false);
                setIsEmailOpen(true);
              }}
              className="border-border"
            >
              <Mail className="w-4 h-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">E-Mail</span>
            </Button>
            
            <Select
              value={selectedFolder.status}
              onValueChange={(value) => updateStatus(selectedFolder.id, value as CaseStatus)}
            >
              <SelectTrigger className="w-32 sm:w-40 bg-input/50 border-border text-xs sm:text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {productStatuses[selectedFolder.product].map((status) => (
                  <SelectItem key={status} value={status}>{getStatusLabel(status, selectedFolder.product)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Label htmlFor="file-upload" className="cursor-pointer">
              <Button asChild size="sm" disabled={isUploading}>
                <span>
                  <Upload className="w-4 h-4 mr-1 md:mr-2" />
                  <span className="hidden sm:inline">{isUploading ? 'Lädt...' : 'Hochladen'}</span>
                </span>
              </Button>
            </Label>
            <Input
              id="file-upload"
              type="file"
              multiple
              className="hidden"
              onChange={handleFileUpload}
            />

            {/* Delete Button - Admin only */}
            {role === 'admin' && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setFolderToDelete(selectedFolder);
                  setIsDeleteDialogOpen(true);
                }}
              >
                <Trash2 className="w-4 h-4 mr-1 md:mr-2" />
                <span className="hidden sm:inline">Löschen</span>
              </Button>
            )}
          </div>
        </div>

        {/* Customer Info */}
        <div className="bg-card/40 backdrop-blur-sm border border-border rounded-xl p-3 md:p-4">
          <h3 className="font-semibold text-foreground">{selectedFolder.customer_name}</h3>
          {selectedFolder.customer_email && (
            <p className="text-sm text-muted-foreground truncate">{selectedFolder.customer_email}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 md:gap-4 mt-2 text-xs text-muted-foreground">
            <span>Erstellt: {new Date(selectedFolder.created_at).toLocaleDateString('de-DE')}</span>
            <span className="text-muted-foreground/50">|</span>
            {role === 'admin' && isEditingPartnerCode ? (
              <span className="flex items-center gap-1">
                <span>Code:</span>
                <Input
                  value={editPartnerCode}
                  onChange={(e) => setEditPartnerCode(e.target.value)}
                  className="h-6 w-28 text-xs px-1.5 py-0"
                  placeholder="Partnercode"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSavePartnerCode();
                    if (e.key === 'Escape') setIsEditingPartnerCode(false);
                  }}
                />
                <button onClick={handleSavePartnerCode} className="text-green-500 hover:text-green-400"><Check className="h-3.5 w-3.5" /></button>
                <button onClick={() => setIsEditingPartnerCode(false)} className="text-destructive hover:text-destructive/80"><X className="h-3.5 w-3.5" /></button>
              </span>
            ) : (
              <span className="flex items-center gap-1">
                Code: {selectedFolder.partner_code || '—'}
                {role === 'admin' && (
                  <button
                    onClick={() => {
                      setEditPartnerCode(selectedFolder.partner_code || '');
                      setIsEditingPartnerCode(true);
                    }}
                    className="text-muted-foreground hover:text-foreground"
                    title="Partnercode bearbeiten"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                )}
              </span>
            )}
            {selectedFolder.product === 'steuern' && selectedFolder.prognose_amount && (
              <>
                <span className="text-muted-foreground/50">|</span>
                <span>Prognose: {selectedFolder.prognose_amount.toFixed(0)} €</span>
                <span className="text-yellow-500 font-medium">Gebühr: {(selectedFolder.prognose_amount * 0.30).toFixed(0)} €</span>
              </>
            )}
          </div>
        </div>

        {/* Documents Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {documents.map((doc) => {
            const { Icon, color } = getFileIcon(doc.file_type);
            return (
              <div
                key={doc.id}
                onClick={() => downloadDocument(doc)}
                className="bg-card/40 backdrop-blur-sm border border-border rounded-xl p-4 cursor-pointer hover:bg-card/60 transition-all"
              >
                <div className="flex items-center justify-center h-16 mb-3">
                  <Icon className={`w-10 h-10 ${color}`} />
                </div>
                <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(doc.created_at).toLocaleDateString('de-DE')}
                </p>
              </div>
            );
          })}
        </div>

        {documents.length === 0 && (
          <div className="bg-card/40 backdrop-blur-sm border border-border rounded-xl min-h-[200px] flex items-center justify-center">
            <div className="text-center space-y-2">
              <FileText className="w-12 h-12 text-muted-foreground/50 mx-auto" />
              <p className="text-muted-foreground">Noch keine Dokumente</p>
              <p className="text-sm text-muted-foreground/70">
                Laden Sie Dokumente hoch um zu beginnen
              </p>
            </div>
          </div>
        )}

        {/* Email Dialog */}
        <EmailDialog
          isOpen={isEmailOpen}
          onClose={() => {
            setIsEmailOpen(false);
            setIsOfferMode(false);
          }}
          customerName={selectedFolder.customer_name}
          customerEmail={selectedFolder.customer_email}
          productType={selectedFolder.product}
          folderName={selectedFolder.name}
          isOfferMode={isOfferMode}
          prognoseAmount={selectedFolder.prognose_amount}
          paymentLinkUrl={selectedFolder.payment_link_url}
          onEmailSent={handleEmailSent}
        />
        
        {/* Prognose Dialog */}
        <PrognoseDialog
          isOpen={isPrognoseOpen}
          onClose={() => setIsPrognoseOpen(false)}
          folderId={selectedFolder.id}
          customerName={selectedFolder.customer_name}
          currentPrognose={selectedFolder.prognose_amount}
          currentInstallments={selectedFolder.installment_count}
          onPrognoseUpdated={handlePrognoseUpdated}
        />

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Ordner löschen?</AlertDialogTitle>
              <AlertDialogDescription>
                Möchten Sie den Ordner "{folderToDelete?.customer_name}" wirklich löschen? 
                Alle zugehörigen Dokumente werden ebenfalls gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Abbrechen</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => folderToDelete && deleteFolder(folderToDelete)}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Löschen...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Löschen
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // EBENE 3: Kundenfälle für ausgewählten Status
  if (selectedProduct && selectedStatus) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={goBack}>
              ← Zurück
            </Button>
            {renderBreadcrumb()}
          </div>
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground">
                <Plus className="w-4 h-4 mr-2" />
                Neuer Kundenordner
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle>Neuen Kundenordner erstellen</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="bg-muted/30 rounded-lg p-3 text-sm">
                  <p><strong>Produkt:</strong> {productConfig[selectedProduct].label}</p>
                  <p><strong>Status:</strong> {getStatusLabel(selectedStatus, selectedProduct)}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer-name">Kundenname *</Label>
                  <Input
                    id="customer-name"
                    placeholder="Max Mustermann"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="bg-input/50 border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer-email">E-Mail</Label>
                  <Input
                    id="customer-email"
                    type="email"
                    placeholder="max@beispiel.de"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="bg-input/50 border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="partner-code">Partner-Code (optional)</Label>
                  <Input
                    id="partner-code"
                    placeholder="z.B. EROL2024"
                    value={partnerCode}
                    onChange={(e) => setPartnerCode(e.target.value)}
                    className="bg-input/50 border-border"
                  />
                </div>
                <Button onClick={createFolder} className="w-full" disabled={!customerName.trim()}>
                  Ordner erstellen
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Customer Folders Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Laden...</p>
          </div>
        ) : filteredFolders.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredFolders.map((folder) => (
              <div
                key={folder.id}
                onClick={() => setSelectedFolder(folder)}
                className="bg-card/40 backdrop-blur-sm border border-border rounded-xl p-4 cursor-pointer hover:bg-card/60 transition-all"
              >
                <div className="aspect-square bg-primary/20 rounded-lg mb-3 flex items-center justify-center relative">
                  <Folder className="w-12 h-12 text-primary" />
                  {/* Installment badge for anzahlung_erhalten status */}
                  {folder.status === 'anzahlung_erhalten' && folder.installment_count && folder.installment_count > 1 && (
                    <div className="absolute -top-2 -right-2 bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                      {folder.installments_paid || 1}/{folder.installment_count}
                    </div>
                  )}
                </div>
                <p className="text-sm font-medium text-foreground truncate">{folder.customer_name}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(folder.created_at).toLocaleDateString('de-DE')}
                </p>
                {/* Next payment info for installment customers */}
                {folder.status === 'anzahlung_erhalten' && folder.next_payment_date && (
                  <p className="text-xs text-amber-500 mt-1">
                    Nächste Rate: {new Date(folder.next_payment_date).toLocaleDateString('de-DE')}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-card/40 backdrop-blur-sm border border-border rounded-xl min-h-[300px] flex items-center justify-center">
            <div className="text-center space-y-2">
              <Folder className="w-12 h-12 text-muted-foreground/50 mx-auto" />
              <p className="text-muted-foreground">Keine Kundenordner vorhanden</p>
              <p className="text-sm text-muted-foreground/70">
                Klicken Sie auf "Neuer Kundenordner" um einen anzulegen
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // EBENE 2: Status-Liste für ausgewähltes Produkt
  if (selectedProduct) {
    const config = productConfig[selectedProduct];
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={goBack}>
            ← Zurück
          </Button>
          {renderBreadcrumb()}
        </div>

        {/* Status List */}
        <div className="bg-card/40 backdrop-blur-sm border border-border rounded-xl overflow-hidden">
          {productStatuses[selectedProduct].map((status, index) => {
            const count = getStatusCount(status);
            const isLast = index === productStatuses[selectedProduct].length - 1;
            return (
              <div
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-all ${!isLast ? 'border-b border-border/50' : ''}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${config.bgColor}`}>
                    <Folder className={`w-5 h-5 ${config.color}`} />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{getStatusLabel(status, selectedProduct)}</p>
                    <p className="text-sm text-muted-foreground">
                      {count} {count === 1 ? 'Kundenordner' : 'Kundenordner'}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // EBENE 1: Produkt-Ordner (Steuern, Kredit, Versicherung)
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Mein Drive</h2>
        <p className="text-sm text-muted-foreground">Wählen Sie eine Kategorie</p>
      </div>

      {/* Product Folders Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Laden...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {allProducts.map((product) => {
            const config = productConfig[product];
            const count = getProductCount(product);
            return (
              <div
                key={product}
                onClick={() => setSelectedProduct(product)}
                className={`border rounded-xl p-6 cursor-pointer hover:scale-[1.02] transition-all ${config.bgColor}`}
              >
                <div className="flex items-center justify-center h-24 mb-4">
                  <Folder className={`w-16 h-16 ${config.color}`} />
                </div>
                <h3 className={`text-lg font-semibold text-center ${config.color}`}>
                  {config.label}
                </h3>
                <p className="text-sm text-center text-muted-foreground mt-1">
                  {count} {count === 1 ? 'Kundenordner' : 'Kundenordner'}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
