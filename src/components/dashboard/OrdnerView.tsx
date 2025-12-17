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
import { Plus, Upload, FileText, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

type CaseStatus = 'neu' | 'bezahlt' | 'in_bearbeitung' | 'abgeschlossen' | 'einspruch';
type ProductType = 'steuern' | 'kredit' | 'versicherung';

interface Folder {
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
  neu: 'Neu',
  bezahlt: 'Bezahlt',
  in_bearbeitung: 'In Bearbeitung',
  abgeschlossen: 'Abgeschlossen',
  einspruch: 'Einspruch',
};

const statusColors: Record<CaseStatus, string> = {
  neu: 'bg-yellow-500/20 text-yellow-400',
  bezahlt: 'bg-green-500/20 text-green-400',
  in_bearbeitung: 'bg-blue-500/20 text-blue-400',
  abgeschlossen: 'bg-emerald-500/20 text-emerald-400',
  einspruch: 'bg-orange-500/20 text-orange-400',
};

const productColors: Record<ProductType, string> = {
  steuern: 'border-l-red-500',
  kredit: 'border-l-blue-500',
  versicherung: 'border-l-green-500',
};

const productLabels: Record<ProductType, string> = {
  steuern: 'Steuern',
  kredit: 'Kredit',
  versicherung: 'Versicherung',
};

export function OrdnerView() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Form state
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [product, setProduct] = useState<ProductType>('steuern');
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
    if (!customerName.trim() || !user?.id) return;

    const date = new Date().toLocaleDateString('de-DE');
    const folderName = `${customerName} - ${date}`;

    const { error } = await supabase.from('folders').insert({
      name: folderName,
      customer_name: customerName,
      customer_email: customerEmail || null,
      product,
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
      setProduct('steuern');
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

  if (selectedFolder) {
    return (
      <div className="space-y-4">
        {/* Folder Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setSelectedFolder(null)}>
              ← Zurück
            </Button>
            <div>
              <h2 className="text-lg font-semibold text-foreground">{selectedFolder.name}</h2>
              <p className="text-sm text-muted-foreground">{selectedFolder.customer_email}</p>
            </div>
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

        {/* Documents Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {documents.map((doc) => (
            <div
              key={doc.id}
              onClick={() => downloadDocument(doc)}
              className="bg-card/40 backdrop-blur-sm border border-border rounded-xl p-4 cursor-pointer transition-all"
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Mein Drive</h2>
          <p className="text-sm text-muted-foreground">Mandanten-Ordner</p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground">
              <Plus className="w-4 h-4 mr-2" />
              Neuer Ordner
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>Neuen Mandanten-Ordner erstellen</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
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
                <Label>Produkt</Label>
                <Select value={product} onValueChange={(v) => setProduct(v as ProductType)}>
                  <SelectTrigger className="bg-input/50 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="steuern">Steuern</SelectItem>
                    <SelectItem value="kredit">Kredit</SelectItem>
                    <SelectItem value="versicherung">Versicherung</SelectItem>
                  </SelectContent>
                </Select>
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

      {/* Folders Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Laden...</p>
        </div>
      ) : folders.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {folders.map((folder) => (
            <div
              key={folder.id}
              onClick={() => setSelectedFolder(folder)}
              className={`bg-card/40 backdrop-blur-sm border border-border border-l-4 ${productColors[folder.product]} rounded-xl p-4 cursor-pointer transition-all`}
            >
              {/* Folder Icon */}
              <div className="aspect-square bg-primary/20 rounded-lg mb-3 flex items-center justify-center">
                <svg viewBox="0 0 80 60" className="w-12 h-12 text-primary" fill="currentColor">
                  <path d="M8 10h24l6 8h34c4.4 0 8 3.6 8 8v24c0 4.4-3.6 8-8 8H8c-4.4 0-8-3.6-8-8V18c0-4.4 3.6-8 8-8z" opacity="0.3"/>
                  <path d="M8 14h24l6 8h34c4.4 0 8 3.6 8 8v20c0 4.4-3.6 8-8 8H8c-4.4 0-8-3.6-8-8V22c0-4.4 3.6-8 8-8z"/>
                </svg>
              </div>
              
              <p className="text-sm font-medium text-foreground truncate">{folder.customer_name}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(folder.created_at).toLocaleDateString('de-DE')}
              </p>
              
              {/* Status Badge */}
              <div className={`mt-2 inline-block px-2 py-0.5 rounded-full text-xs ${statusColors[folder.status]}`}>
                {statusLabels[folder.status]}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-card/40 backdrop-blur-sm border border-border rounded-xl min-h-[300px] flex items-center justify-center">
          <div className="text-center space-y-2">
            <p className="text-muted-foreground">Noch keine Ordner vorhanden</p>
            <p className="text-sm text-muted-foreground/70">
              Klicken Sie auf "Neuer Ordner" um zu beginnen
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
