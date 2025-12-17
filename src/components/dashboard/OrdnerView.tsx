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
import { Plus, Upload, FileText, ChevronRight, Folder } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

type CaseStatus = 'neu' | 'bezahlt' | 'in_bearbeitung' | 'abgeschlossen' | 'einspruch';
type ProductType = 'steuern' | 'kredit' | 'versicherung';

interface FolderData {
  id: string;
  name: string;
  customer_name: string;
  customer_email: string | null;
  status: CaseStatus;
  product: ProductType;
  partner_code: string | null;
  created_at: string;
}

interface Document {
  id: string;
  name: string;
  file_path: string;
  file_type: string | null;
  created_at: string;
}

const statusLabels: Record<CaseStatus, string> = {
  neu: 'Neu / Anfrage',
  bezahlt: 'Bezahlt',
  in_bearbeitung: 'In Bearbeitung',
  abgeschlossen: 'Abgeschlossen',
  einspruch: 'Einspruch',
};

const statusColors: Record<CaseStatus, string> = {
  neu: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  bezahlt: 'bg-green-500/20 text-green-400 border-green-500/30',
  in_bearbeitung: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  abgeschlossen: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  einspruch: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
};

const productConfig: Record<ProductType, { label: string; color: string; bgColor: string }> = {
  steuern: { 
    label: 'Steuererklärung', 
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20 border-blue-500/30'
  },
  kredit: { 
    label: 'Kredit', 
    color: 'text-red-400',
    bgColor: 'bg-red-500/20 border-red-500/30'
  },
  versicherung: { 
    label: 'Versicherung', 
    color: 'text-green-400',
    bgColor: 'bg-green-500/20 border-green-500/30'
  },
};

const allStatuses: CaseStatus[] = ['neu', 'bezahlt', 'in_bearbeitung', 'abgeschlossen', 'einspruch'];
const allProducts: ProductType[] = ['steuern', 'kredit', 'versicherung'];

export function OrdnerView() {
  const { user } = useAuth();
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
    if (selectedStatus) parts.push(statusLabels[selectedStatus]);
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
    const parts = getBreadcrumb();
    return (
      <div className="flex items-center gap-2 text-sm">
        {parts.map((part, index) => (
          <div key={index} className="flex items-center gap-2">
            {index > 0 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
            <span className={index === parts.length - 1 ? 'text-foreground font-medium' : 'text-muted-foreground'}>
              {part}
            </span>
          </div>
        ))}
      </div>
    );
  };

  // EBENE 4: Dokumente im Kundenordner
  if (selectedFolder) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={goBack}>
              ← Zurück
            </Button>
            {renderBreadcrumb()}
          </div>
          
          <div className="flex items-center gap-2">
            <Select
              value={selectedFolder.status}
              onValueChange={(value) => updateStatus(selectedFolder.id, value as CaseStatus)}
            >
              <SelectTrigger className="w-40 bg-input/50 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(statusLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Label htmlFor="file-upload" className="cursor-pointer">
              <Button asChild disabled={isUploading}>
                <span>
                  <Upload className="w-4 h-4 mr-2" />
                  {isUploading ? 'Lädt...' : 'Hochladen'}
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
          </div>
        </div>

        {/* Customer Info */}
        <div className="bg-card/40 backdrop-blur-sm border border-border rounded-xl p-4">
          <h3 className="font-semibold text-foreground">{selectedFolder.customer_name}</h3>
          {selectedFolder.customer_email && (
            <p className="text-sm text-muted-foreground">{selectedFolder.customer_email}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            Erstellt: {new Date(selectedFolder.created_at).toLocaleDateString('de-DE')}
          </p>
        </div>

        {/* Documents Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {documents.map((doc) => (
            <div
              key={doc.id}
              onClick={() => downloadDocument(doc)}
              className="bg-card/40 backdrop-blur-sm border border-border rounded-xl p-4 cursor-pointer hover:bg-card/60 transition-all"
            >
              <div className="flex items-center justify-center h-16 mb-3">
                <FileText className="w-10 h-10 text-primary/60" />
              </div>
              <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(doc.created_at).toLocaleDateString('de-DE')}
              </p>
            </div>
          ))}
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
                  <p><strong>Status:</strong> {statusLabels[selectedStatus]}</p>
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
                <div className="aspect-square bg-primary/20 rounded-lg mb-3 flex items-center justify-center">
                  <Folder className="w-12 h-12 text-primary" />
                </div>
                <p className="text-sm font-medium text-foreground truncate">{folder.customer_name}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(folder.created_at).toLocaleDateString('de-DE')}
                </p>
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

  // EBENE 2: Status-Ordner für ausgewähltes Produkt
  if (selectedProduct) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={goBack}>
            ← Zurück
          </Button>
          {renderBreadcrumb()}
        </div>

        {/* Status Folders Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {allStatuses.map((status) => {
            const count = getStatusCount(status);
            return (
              <div
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`border rounded-xl p-4 cursor-pointer hover:scale-[1.02] transition-all ${statusColors[status]}`}
              >
                <div className="aspect-square rounded-lg mb-3 flex items-center justify-center bg-background/20">
                  <Folder className="w-12 h-12" />
                </div>
                <p className="text-sm font-medium truncate">{statusLabels[status]}</p>
                <p className="text-xs opacity-70">
                  {count} {count === 1 ? 'Ordner' : 'Ordner'}
                </p>
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
