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
import { useVisibleProducts } from '@/hooks/useVisibleProducts';
import { useCustomProducts, type CustomProduct } from '@/hooks/useCustomProducts';
import { getColorPreset } from '@/lib/customProductColors';
import { EmailDialog } from './EmailDialog';
import { PrognoseDialog } from './PrognoseDialog';
import { OrdnerVisibilitySettings } from './OrdnerVisibilitySettings';

// Include all database enum values for type compatibility, but only show relevant ones in UI
type CaseStatus = 'neu' | 'bezahlt' | 'abgeschickt' | 'in_bearbeitung' | 'abgeschlossen' | 'einspruch' | 'anfrage_eingegangen' | 'prognose_erstellt' | 'angebot_gesendet' | 'anzahlung_erhalten' | 'einspruch_nacharbeit' | 'rueckstand';
type ProductType = 'steuern' | 'kredit' | 'versicherung' | 'problemfall' | 'global_sourcing' | 'unternehmensberatung' | 'ai_due_diligence' | 'payment_solutions' | 'solaranlagen' | 'immobilien' | 'rechtsberatung' | 'sonstiges';

interface FolderData {
  id: string;
  name: string;
  customer_name: string;
  customer_email: string | null;
  status: CaseStatus | null;
  custom_product_id: string | null;
  custom_status_id: string | null;
  product: ProductType | null;
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
  payment_token: string;
}

// Customer-facing portal URL. The token is permanent per folder; the customer
// chooses one-time vs. installment plan on the page, then Stripe takes over.
const PORTAL_BASE = 'https://clairmont-advisory.com/pay';
const buildPortalUrl = (token: string) => `${PORTAL_BASE}?t=${token}`;

interface Document {
  id: string;
  name: string;
  file_path: string;
  file_type: string | null;
  created_at: string;
}

// Status options per product
const productStatuses: Record<ProductType, CaseStatus[]> = {
  steuern: ['anfrage_eingegangen', 'prognose_erstellt', 'angebot_gesendet', 'anzahlung_erhalten', 'rueckstand', 'bezahlt', 'abgeschickt', 'einspruch_nacharbeit'],
  kredit: ['neu', 'anzahlung_erhalten', 'rueckstand', 'bezahlt', 'einspruch'],
  versicherung: ['neu', 'anzahlung_erhalten', 'rueckstand', 'bezahlt', 'einspruch'],
  problemfall: ['neu', 'abgeschlossen'],
  global_sourcing: ['neu', 'in_bearbeitung', 'abgeschlossen'],
  unternehmensberatung: ['neu', 'in_bearbeitung', 'abgeschlossen'],
  ai_due_diligence: ['neu', 'in_bearbeitung', 'abgeschlossen'],
  payment_solutions: ['neu', 'in_bearbeitung', 'abgeschlossen'],
  solaranlagen: ['neu', 'in_bearbeitung', 'abgeschlossen'],
  immobilien: ['neu', 'in_bearbeitung', 'abgeschlossen'],
  rechtsberatung: ['neu', 'in_bearbeitung', 'abgeschlossen'],
  sonstiges: ['neu', 'in_bearbeitung', 'abgeschlossen'],
};

const statusLabels: Record<CaseStatus, string> = {
  neu: 'Neu / Anfrage',
  bezahlt: 'Bezahlt',
  abgeschickt: 'Abgeschickt',
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
    bgColor: 'bg-blue-500/[0.08] border-blue-400/20 shadow-lg shadow-blue-500/[0.06]'
  },
  versicherung: {
    label: 'Baufinanzierungsfälle',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/[0.08] border-emerald-400/20 shadow-lg shadow-emerald-500/[0.06]'
  },
  kredit: {
    label: 'Kreditfälle',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/[0.08] border-yellow-400/20 shadow-lg shadow-yellow-500/[0.06]'
  },
  problemfall: {
    label: 'Problemfälle',
    color: 'text-red-400',
    bgColor: 'bg-red-500/[0.08] border-red-400/20 shadow-lg shadow-red-500/[0.06]'
  },
  global_sourcing: {
    label: 'Global Sourcing & Deals',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/[0.08] border-orange-400/20 shadow-lg shadow-orange-500/[0.06]'
  },
  unternehmensberatung: {
    label: 'Unternehmensberatung',
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/[0.08] border-violet-400/20 shadow-lg shadow-violet-500/[0.06]'
  },
  ai_due_diligence: {
    label: 'AI & Due Diligence',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/[0.08] border-cyan-400/20 shadow-lg shadow-cyan-500/[0.06]'
  },
  payment_solutions: {
    label: 'Payment Solutions',
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/[0.08] border-pink-400/20 shadow-lg shadow-pink-500/[0.06]'
  },
  solaranlagen: {
    label: 'Solaranlagen & Wärmepumpen',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/[0.08] border-amber-400/20 shadow-lg shadow-amber-500/[0.06]'
  },
  immobilien: {
    label: 'Immobilien',
    color: 'text-teal-400',
    bgColor: 'bg-teal-500/[0.08] border-teal-400/20 shadow-lg shadow-teal-500/[0.06]'
  },
  rechtsberatung: {
    label: 'Rechtsberatung',
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/[0.08] border-indigo-400/20 shadow-lg shadow-indigo-500/[0.06]'
  },
  sonstiges: {
    label: 'Sonstiges',
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/[0.08] border-gray-400/20 shadow-lg shadow-gray-500/[0.06]'
  },
};

const allProducts: ProductType[] = ['steuern', 'versicherung', 'kredit', 'problemfall', 'global_sourcing', 'unternehmensberatung', 'ai_due_diligence', 'payment_solutions', 'solaranlagen', 'immobilien', 'rechtsberatung', 'sonstiges'];

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

interface OrdnerViewProps {
  searchFolderId?: string;
  onSearchConsumed?: () => void;
}

export function OrdnerView({ searchFolderId, onSearchConsumed }: OrdnerViewProps) {
  const { user, role } = useAuth();
  const { toast } = useToast();
  
  // Navigation state
  const [selectedProduct, setSelectedProduct] = useState<ProductType | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<CaseStatus | null>(null);
  const [selectedCustomProductId, setSelectedCustomProductId] = useState<string | null>(null);
  const [selectedCustomStatusId, setSelectedCustomStatusId] = useState<string | null>(null);
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

  // Admin-defined custom folder categories (Phase 2)
  const { customProducts } = useCustomProducts();

  // Per-user product visibility (admin/sachbearbeiter via settings popover,
  // vertriebler auto-computed from their partner_codes against folders)
  const {
    visibleProducts,
    visibilityMap,
    toggleVisibility,
    visibleCustomProductIds,
    customVisibilityMap,
    toggleCustomVisibility,
    canManageVisibility,
    isAdmin,
  } = useVisibleProducts(user?.id, role, folders, customProducts);

  const visibleCustomProducts = customProducts.filter((cp) => visibleCustomProductIds.has(cp.id));
  const selectedCustomProduct: CustomProduct | undefined =
    selectedCustomProductId !== null
      ? customProducts.find((cp) => cp.id === selectedCustomProductId)
      : undefined;
  const selectedCustomStatus = selectedCustomProduct?.statuses.find(
    (s) => s.id === selectedCustomStatusId
  );

  useEffect(() => {
    fetchFolders();
  }, []);

  useEffect(() => {
    if (searchFolderId && folders.length > 0) {
      const target = folders.find(f => f.id === searchFolderId);
      if (target) {
        if (target.custom_product_id) {
          setSelectedCustomProductId(target.custom_product_id);
          setSelectedCustomStatusId(null);
          setSelectedProduct(null);
          setSelectedStatus(null);
        } else {
          setSelectedProduct(target.product);
          setSelectedStatus(null);
          setSelectedCustomProductId(null);
          setSelectedCustomStatusId(null);
        }
        setSelectedFolder(target);
        onSearchConsumed?.();
      }
    }
  }, [searchFolderId, folders]);

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

  const handleSavePartnerCode = async () => {
    if (!selectedFolder) return;
    const newCode = editPartnerCode.trim() || null;
    const { error } = await supabase
      .from('folders')
      .update({ partner_code: newCode })
      .eq('id', selectedFolder.id);
    if (error) {
      toast({ title: 'Fehler', description: 'Partnercode konnte nicht gespeichert werden.', variant: 'destructive' });
    } else {
      setSelectedFolder({ ...selectedFolder, partner_code: newCode });
      setFolders(prev => prev.map(f => f.id === selectedFolder.id ? { ...f, partner_code: newCode } : f));
      toast({ title: 'Partnercode aktualisiert' });
      
      // Notify Vertriebler if a new partner code was assigned
      if (newCode) {
        const cpLabel = selectedFolder.custom_product_id
          ? customProducts.find((cp) => cp.id === selectedFolder.custom_product_id)?.label ?? null
          : selectedFolder.product;
        supabase.functions.invoke('notify-vertriebler', {
          body: {
            type: 'new_customer',
            partnerCode: newCode,
            customerName: selectedFolder.customer_name,
            productType: cpLabel,
          },
        }).catch(err => console.error('Failed to notify Vertriebler:', err));
      }
    }
    setIsEditingPartnerCode(false);
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
    if (!customerName.trim() || !user?.id) return;

    const isCustomCreate = selectedCustomProductId !== null;
    if (isCustomCreate) {
      if (!selectedCustomStatusId) return;
    } else if (!selectedProduct || !selectedStatus) {
      return;
    }

    const date = new Date().toLocaleDateString('de-DE');
    const folderName = `${customerName} - ${date}`;

    const { error } = await supabase.from('folders').insert({
      name: folderName,
      customer_name: customerName,
      customer_email: customerEmail || null,
      product: isCustomCreate ? null : selectedProduct,
      status: isCustomCreate ? null : selectedStatus,
      custom_product_id: isCustomCreate ? selectedCustomProductId : null,
      custom_status_id: isCustomCreate ? selectedCustomStatusId : null,
      partner_code: partnerCode || null,
      created_by: user.id,
    });

    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Ordner erstellt', description: folderName });
      
      // Notify Vertriebler if partner code was set
      if (partnerCode?.trim()) {
        const customLabel = isCustomCreate
          ? selectedCustomProduct?.label ?? 'Eigener Ordner'
          : null;
        supabase.functions.invoke('notify-vertriebler', {
          body: {
            type: 'new_customer',
            partnerCode: partnerCode.trim(),
            customerName: customerName,
            productType: isCustomCreate ? customLabel : selectedProduct,
          },
        }).catch(err => console.error('Failed to notify Vertriebler:', err));
      }
      
      setIsCreateOpen(false);
      setCustomerName('');
      setCustomerEmail('');
      setPartnerCode('');
      fetchFolders();
    }
  };

  const updateStatus = async (folderId: string, value: string) => {
    // Find the folder to know if we're updating the native or custom status
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;

    const isCustom = folder.custom_product_id !== null;
    const update = isCustom
      ? { custom_status_id: value }
      : { status: value as CaseStatus };

    const { error } = await supabase
      .from('folders')
      .update(update)
      .eq('id', folderId);

    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    } else {
      // Notify Vertriebler about status change — send a human-readable label
      if (folder.partner_code) {
        let label: string = value;
        if (isCustom) {
          const cp = customProducts.find(p => p.id === folder.custom_product_id);
          label = cp?.statuses.find(s => s.id === value)?.label ?? value;
        }
        supabase.functions.invoke('notify-vertriebler', {
          body: {
            type: 'status_change',
            partnerCode: folder.partner_code,
            customerName: folder.customer_name,
            newStatus: label,
          },
        }).catch(err => console.error('Failed to notify Vertriebler:', err));
      }

      fetchFolders();
      if (selectedFolder?.id === folderId) {
        setSelectedFolder({
          ...selectedFolder,
          ...(isCustom
            ? { custom_status_id: value }
            : { status: value as CaseStatus }),
        });
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

  const handlePrognoseUpdated = (amount: number) => {
    if (selectedFolder) {
      setSelectedFolder({
        ...selectedFolder,
        prognose_amount: amount,
        prognose_created_at: new Date().toISOString(),
        status: 'prognose_erstellt',
        installment_count: 1,
        installment_fee: 0,
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
      // Customer picks one-time vs. installments themselves on the portal.
      // We only mark the folder as "Angebot gesendet" and refresh the timestamp.
      const { error } = await supabase
        .from('folders')
        .update({
          status: 'angebot_gesendet',
          prognose_created_at: new Date().toISOString(),
        })
        .eq('id', selectedFolder.id);

      if (error) throw error;

      setSelectedFolder({
        ...selectedFolder,
        status: 'angebot_gesendet',
        prognose_created_at: new Date().toISOString(),
      });

      // Open email dialog with the portal URL as the CTA target.
      setIsOfferMode(true);
      setIsEmailOpen(true);

      toast({
        title: 'Angebot bereit',
        description: 'Passen Sie die E-Mail an und senden Sie sie ab.',
      });

      fetchFolders();
    } catch (error) {
      console.error('Error preparing offer:', error);
      toast({
        title: 'Fehler',
        description: 'Das Angebot konnte nicht vorbereitet werden.',
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
    } else if (selectedCustomStatusId) {
      setSelectedCustomStatusId(null);
    } else if (selectedProduct) {
      setSelectedProduct(null);
    } else if (selectedCustomProductId) {
      setSelectedCustomProductId(null);
    }
  };

  // Get breadcrumb path
  const getBreadcrumb = () => {
    const parts: string[] = ['Drive'];
    if (selectedProduct) parts.push(productConfig[selectedProduct].label);
    if (selectedStatus && selectedProduct) parts.push(getStatusLabel(selectedStatus, selectedProduct));
    if (selectedCustomProduct) parts.push(selectedCustomProduct.label);
    if (selectedCustomStatus) parts.push(selectedCustomStatus.label);
    if (selectedFolder) parts.push(selectedFolder.customer_name);
    return parts;
  };

  // Filter folders by selected (native OR custom) product+status
  const filteredFolders = folders.filter((f) => {
    if (selectedCustomProductId) {
      return (
        f.custom_product_id === selectedCustomProductId &&
        f.custom_status_id === selectedCustomStatusId
      );
    }
    return f.product === selectedProduct && f.status === selectedStatus;
  });

  // Count folders per status for current product
  const getStatusCount = (status: CaseStatus) => {
    return folders.filter(f => f.product === selectedProduct && f.status === status).length;
  };

  const getCustomStatusCount = (statusId: string) => {
    return folders.filter(
      (f) => f.custom_product_id === selectedCustomProductId && f.custom_status_id === statusId
    ).length;
  };

  // Count folders per product
  const getProductCount = (product: ProductType) => {
    return folders.filter(f => f.product === product).length;
  };

  const getCustomProductCount = (id: string) => {
    return folders.filter((f) => f.custom_product_id === id).length;
  };

  // Render breadcrumb navigation
  const renderBreadcrumb = () => {
    const handleBreadcrumbClick = (index: number) => {
      if (index === 0) {
        // "Drive" - back to product selection
        setSelectedProduct(null);
        setSelectedStatus(null);
        setSelectedCustomProductId(null);
        setSelectedCustomStatusId(null);
        setSelectedFolder(null);
        setDocuments([]);
      } else if (index === 1) {
        // Product label - back to status list
        setSelectedStatus(null);
        setSelectedCustomStatusId(null);
        setSelectedFolder(null);
        setDocuments([]);
      } else if (index === 2) {
        // Status - back to folder list
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

            {/* Payment portal actions — shown once an offer has been prepared */}
            {(selectedFolder.status === 'angebot_gesendet' || selectedFolder.payment_status) && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border"
                  onClick={() => window.open(buildPortalUrl(selectedFolder.payment_token), '_blank', 'noopener,noreferrer')}
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(buildPortalUrl(selectedFolder.payment_token));
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
            
            {selectedFolder.custom_product_id ? (
              <Select
                value={selectedFolder.custom_status_id ?? undefined}
                onValueChange={(value) => updateStatus(selectedFolder.id, value)}
              >
                <SelectTrigger className="w-32 sm:w-40 bg-input/50 border-border text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(customProducts.find((cp) => cp.id === selectedFolder.custom_product_id)
                    ?.statuses ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : selectedFolder.product ? (
              <Select
                value={selectedFolder.status ?? undefined}
                onValueChange={(value) => updateStatus(selectedFolder.id, value)}
              >
                <SelectTrigger className="w-32 sm:w-40 bg-input/50 border-border text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {productStatuses[selectedFolder.product].map((status) => (
                    <SelectItem key={status} value={status}>{getStatusLabel(status, selectedFolder.product!)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            
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
        <div className="glass-subtle p-3 md:p-4">
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
                className="glass-subtle p-4 cursor-pointer hover:bg-white/[0.06] transition-all"
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
          <div className="glass-subtle min-h-[200px] flex items-center justify-center">
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
          productType={selectedFolder.product ?? undefined}
          folderName={selectedFolder.name}
          isOfferMode={isOfferMode}
          prognoseAmount={selectedFolder.prognose_amount}
          paymentLinkUrl={isOfferMode ? buildPortalUrl(selectedFolder.payment_token) : null}
          onEmailSent={handleEmailSent}
        />
        
        {/* Prognose Dialog */}
        <PrognoseDialog
          isOpen={isPrognoseOpen}
          onClose={() => setIsPrognoseOpen(false)}
          folderId={selectedFolder.id}
          customerName={selectedFolder.customer_name}
          currentPrognose={selectedFolder.prognose_amount}
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

  // EBENE 3: Kundenfälle für ausgewählten Status (native ODER custom)
  if ((selectedProduct && selectedStatus) || (selectedCustomProductId && selectedCustomStatusId)) {
    const headerProductLabel = selectedCustomProduct
      ? selectedCustomProduct.label
      : selectedProduct
        ? productConfig[selectedProduct].label
        : '';
    const headerStatusLabel = selectedCustomStatus
      ? selectedCustomStatus.label
      : selectedStatus && selectedProduct
        ? getStatusLabel(selectedStatus, selectedProduct)
        : '';
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
                  <p><strong>Produkt:</strong> {headerProductLabel}</p>
                  <p><strong>Status:</strong> {headerStatusLabel}</p>
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
                className="glass-subtle p-4 cursor-pointer hover:bg-white/[0.06] transition-all"
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
          <div className="glass-subtle min-h-[300px] flex items-center justify-center">
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

  // EBENE 2: Status-Liste für ausgewähltes Produkt (native ODER custom)
  if (selectedCustomProductId && selectedCustomProduct) {
    const preset = getColorPreset(selectedCustomProduct.color_token);
    const statuses = selectedCustomProduct.statuses;
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={goBack}>
            ← Zurück
          </Button>
          {renderBreadcrumb()}
        </div>

        <div className="glass-subtle overflow-hidden">
          {statuses.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Noch keine Unterordner. Ein Admin kann sie über "Eigene Ordner verwalten" anlegen.
            </div>
          ) : (
            statuses.map((s, index) => {
              const count = getCustomStatusCount(s.id);
              const isLast = index === statuses.length - 1;
              return (
                <div
                  key={s.id}
                  onClick={() => setSelectedCustomStatusId(s.id)}
                  className={`flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-all ${!isLast ? 'border-b border-border/50' : ''}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${preset.bgColor}`}>
                      <Folder className={`w-5 h-5 ${preset.color}`} />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{s.label}</p>
                      <p className="text-sm text-muted-foreground">
                        {count} Kundenordner
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

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
        <div className="glass-subtle overflow-hidden">
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
  const productLabelsMap = allProducts.reduce(
    (acc, p) => ({ ...acc, [p]: productConfig[p].label }),
    {} as Record<ProductType, string>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Mein Drive</h2>
          <p className="text-sm text-muted-foreground">Wählen Sie eine Kategorie</p>
        </div>
        {canManageVisibility && (
          <OrdnerVisibilitySettings
            visibilityMap={visibilityMap}
            productLabels={productLabelsMap}
            customProducts={customProducts}
            customVisibilityMap={customVisibilityMap}
            onToggle={toggleVisibility}
            onToggleCustom={toggleCustomVisibility}
            isAdmin={isAdmin}
          />
        )}
      </div>

      {/* Product Folders Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Laden...</p>
        </div>
      ) : visibleProducts.length === 0 && visibleCustomProducts.length === 0 ? (
        <div className="glass-subtle min-h-[300px] flex items-center justify-center">
          <div className="text-center space-y-2">
            <Folder className="w-12 h-12 text-muted-foreground/50 mx-auto" />
            <p className="text-muted-foreground">Keine Ordner sichtbar</p>
            {canManageVisibility && (
              <p className="text-sm text-muted-foreground/70">
                Klicken Sie oben rechts auf "Ordner verwalten" um Kategorien einzublenden.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {visibleProducts.map((product) => {
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

          {visibleCustomProducts.map((cp) => {
            const preset = getColorPreset(cp.color_token);
            const count = getCustomProductCount(cp.id);
            return (
              <div
                key={cp.id}
                onClick={() => setSelectedCustomProductId(cp.id)}
                className={`border rounded-xl p-6 cursor-pointer hover:scale-[1.02] transition-all ${preset.bgColor}`}
              >
                <div className="flex items-center justify-center h-24 mb-4">
                  <Folder className={`w-16 h-16 ${preset.color}`} />
                </div>
                <h3 className={`text-lg font-semibold text-center ${preset.color}`}>
                  {cp.label}
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
