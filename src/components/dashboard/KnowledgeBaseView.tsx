import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, FileText, Upload, Trash2, BookOpen, Loader2 } from 'lucide-react';

interface KnowledgeBaseEntry {
  id: string;
  title: string;
  content: string | null;
  file_path: string | null;
  file_name: string | null;
  content_type: string;
  product_type: string | null;
  created_at: string;
}

const productTypeLabels: Record<string, string> = {
  steuern: 'Steuern',
  kredit: 'Kredit',
  versicherung: 'Baufinanzierung',
};

export function KnowledgeBaseView() {
  const { toast } = useToast();
  const [entries, setEntries] = useState<KnowledgeBaseEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteEntry, setDeleteEntry] = useState<KnowledgeBaseEntry | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [contentType, setContentType] = useState<'text' | 'pdf'>('text');
  const [productType, setProductType] = useState<string>('all');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    try {
      const { data, error } = await supabase
        .from('knowledge_base')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEntries(data || []);
    } catch (error) {
      console.error('Error fetching knowledge base:', error);
      toast({
        title: 'Fehler',
        description: 'Knowledge Base konnte nicht geladen werden.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast({
        title: 'Titel erforderlich',
        description: 'Bitte gib einen Titel ein.',
        variant: 'destructive',
      });
      return;
    }

    if (contentType === 'text' && !content.trim()) {
      toast({
        title: 'Inhalt erforderlich',
        description: 'Bitte gib einen Inhalt ein.',
        variant: 'destructive',
      });
      return;
    }

    if (contentType === 'pdf' && !selectedFile) {
      toast({
        title: 'Datei erforderlich',
        description: 'Bitte wähle eine PDF-Datei aus.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      let filePath: string | null = null;
      let fileName: string | null = null;

      if (contentType === 'pdf' && selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('knowledge-base')
          .upload(uniqueName, selectedFile);

        if (uploadError) throw uploadError;
        
        filePath = uniqueName;
        fileName = selectedFile.name;
      }

      const insertData = {
        title,
        content: contentType === 'text' ? content : null,
        file_path: filePath,
        file_name: fileName,
        content_type: contentType,
        product_type: productType === 'all' ? null : (productType as 'steuern' | 'kredit' | 'versicherung'),
      };

      const { error } = await supabase.from('knowledge_base').insert(insertData);

      if (error) throw error;

      toast({
        title: 'Gespeichert',
        description: 'Der Eintrag wurde zur Knowledge Base hinzugefügt.',
      });

      // Reset and close
      setTitle('');
      setContent('');
      setContentType('text');
      setProductType('all');
      setSelectedFile(null);
      setIsDialogOpen(false);
      fetchEntries();
    } catch (error) {
      console.error('Error saving entry:', error);
      toast({
        title: 'Fehler',
        description: 'Der Eintrag konnte nicht gespeichert werden.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteEntry) return;

    try {
      // Delete file from storage if exists
      if (deleteEntry.file_path) {
        await supabase.storage.from('knowledge-base').remove([deleteEntry.file_path]);
      }

      const { error } = await supabase
        .from('knowledge_base')
        .delete()
        .eq('id', deleteEntry.id);

      if (error) throw error;

      toast({
        title: 'Gelöscht',
        description: 'Der Eintrag wurde entfernt.',
      });

      setDeleteEntry(null);
      fetchEntries();
    } catch (error) {
      console.error('Error deleting entry:', error);
      toast({
        title: 'Fehler',
        description: 'Der Eintrag konnte nicht gelöscht werden.',
        variant: 'destructive',
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast({
          title: 'Ungültiges Format',
          description: 'Bitte wähle eine PDF-Datei aus.',
          variant: 'destructive',
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="w-5 h-5 md:w-6 md:h-6" />
            Knowledge Base
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Verwalte das Wissen für den KI-Assistenten
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          Neuer Eintrag
        </Button>
      </div>

      {/* Entries Grid */}
      {entries.length === 0 ? (
        <Card className="bg-card/50 border-border">
          <CardContent className="flex flex-col items-center justify-center py-8 md:py-12">
            <BookOpen className="w-10 h-10 md:w-12 md:h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center text-sm md:text-base">
              Noch keine Einträge vorhanden.<br />
              Füge Wissen hinzu, damit die KI bessere Antworten geben kann.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry) => (
            <Card key={entry.id} className="bg-card/50 border-border hover:border-primary/30 transition-colors">
              <CardHeader className="pb-2 p-3 md:p-6 md:pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {entry.content_type === 'pdf' ? (
                      <Upload className="w-4 h-4 text-primary shrink-0" />
                    ) : (
                      <FileText className="w-4 h-4 text-primary shrink-0" />
                    )}
                    <CardTitle className="text-sm md:text-base truncate">{entry.title}</CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => setDeleteEntry(entry)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
                <div className="space-y-2">
                  {entry.product_type && (
                    <span className="inline-block text-xs px-2 py-1 rounded-full bg-primary/20 text-primary">
                      {productTypeLabels[entry.product_type] || entry.product_type}
                    </span>
                  )}
                  {!entry.product_type && (
                    <span className="inline-block text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                      Alle Bereiche
                    </span>
                  )}
                  {entry.content_type === 'text' ? (
                    <p className="text-xs md:text-sm text-muted-foreground line-clamp-3">
                      {entry.content}
                    </p>
                  ) : (
                    <p className="text-xs md:text-sm text-muted-foreground truncate">
                      📄 {entry.file_name}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {new Date(entry.created_at).toLocaleDateString('de-DE')}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Entry Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Neuer Knowledge Base Eintrag</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="kb-title">Titel</Label>
              <Input
                id="kb-title"
                placeholder="z.B. Ablauf Steuererklärung"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-input/50 border-border"
              />
            </div>

            <div className="space-y-2">
              <Label>Bereich (optional)</Label>
              <Select value={productType} onValueChange={setProductType}>
                <SelectTrigger className="bg-input/50 border-border">
                  <SelectValue placeholder="Alle Bereiche" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Bereiche</SelectItem>
                  <SelectItem value="steuern">Steuern</SelectItem>
                  <SelectItem value="kredit">Kredit</SelectItem>
                  <SelectItem value="versicherung">Baufinanzierung</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Inhaltstyp</Label>
              <Select value={contentType} onValueChange={(v) => setContentType(v as 'text' | 'pdf')}>
                <SelectTrigger className="bg-input/50 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="pdf">PDF-Datei</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {contentType === 'text' ? (
              <div className="space-y-2">
                <Label htmlFor="kb-content">Inhalt</Label>
                <Textarea
                  id="kb-content"
                  placeholder="Gib hier das Wissen ein, das die KI nutzen soll..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="bg-input/50 border-border min-h-[150px]"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="kb-file">PDF-Datei</Label>
                <Input
                  id="kb-file"
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="bg-input/50 border-border"
                />
                {selectedFile && (
                  <p className="text-sm text-muted-foreground">
                    Ausgewählt: {selectedFile.name}
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Speichern...
                </>
              ) : (
                'Speichern'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteEntry} onOpenChange={() => setDeleteEntry(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Eintrag löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchtest du "{deleteEntry?.title}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
