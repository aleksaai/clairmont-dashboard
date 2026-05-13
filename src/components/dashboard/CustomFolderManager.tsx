import { useState } from 'react';
import { Plus, Trash2, Folder, FolderPlus } from 'lucide-react';
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
import { COLOR_PRESETS, getColorPreset, type ColorToken } from '@/lib/customProductColors';
import {
  useCustomProducts,
  type CustomProduct,
  type CustomStatus,
} from '@/hooks/useCustomProducts';

const DEFAULT_NEW_STATUSES = [
  { name: 'neu', label: 'Neu' },
  { name: 'in_bearbeitung', label: 'In Bearbeitung' },
  { name: 'abgeschlossen', label: 'Abgeschlossen' },
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

interface CustomFolderManagerProps {
  triggerLabel?: string;
}

export function CustomFolderManager({ triggerLabel = 'Eigene Ordner verwalten' }: CustomFolderManagerProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const {
    customProducts,
    createCustomProduct,
    updateCustomProduct,
    deleteCustomProduct,
    addCustomStatus,
    updateCustomStatus,
    deleteCustomStatus,
  } = useCustomProducts();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="border-border">
          <FolderPlus className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">{triggerLabel}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Eigene Ordner verwalten</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {customProducts.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Noch keine eigenen Ordner angelegt. Erstelle unten den ersten.
            </p>
          )}

          {customProducts.map((product) => (
            <ExistingProductCard
              key={product.id}
              product={product}
              onLabelChange={(label) => updateCustomProduct(product.id, { label }).catch(handleErr(toast))}
              onColorChange={(token) =>
                updateCustomProduct(product.id, { color_token: token }).catch(handleErr(toast))
              }
              onDelete={() => deleteCustomProduct(product.id).catch(handleErr(toast))}
              onAddStatus={(s) => addCustomStatus(product.id, s).catch(handleErr(toast))}
              onUpdateStatus={(id, patch) => updateCustomStatus(id, patch).catch(handleErr(toast))}
              onDeleteStatus={(id) => deleteCustomStatus(id).catch(handleErr(toast))}
            />
          ))}

          <div className="border-t border-border pt-4">
            <NewProductForm
              onCreate={async (input) => {
                try {
                  await createCustomProduct(input);
                  toast({ title: 'Ordner erstellt', description: input.label });
                } catch (e: unknown) {
                  handleErr(toast)(e);
                }
              }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function handleErr(toast: ReturnType<typeof useToast>['toast']) {
  return (e: unknown) => {
    const msg = e instanceof Error ? e.message : 'Aktion fehlgeschlagen.';
    toast({ title: 'Fehler', description: msg, variant: 'destructive' });
  };
}

// ---------------------------------------------------------------
// Existing product editor card
// ---------------------------------------------------------------
interface ExistingProductCardProps {
  product: CustomProduct;
  onLabelChange: (label: string) => void;
  onColorChange: (token: ColorToken) => void;
  onDelete: () => void;
  onAddStatus: (s: { name: string; label: string }) => void;
  onUpdateStatus: (id: string, patch: Partial<Pick<CustomStatus, 'label'>>) => void;
  onDeleteStatus: (id: string) => void;
}

function ExistingProductCard({
  product,
  onLabelChange,
  onColorChange,
  onDelete,
  onAddStatus,
  onUpdateStatus,
  onDeleteStatus,
}: ExistingProductCardProps) {
  const [label, setLabel] = useState(product.label);
  const [newStatusLabel, setNewStatusLabel] = useState('');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const preset = getColorPreset(product.color_token);

  const handleLabelBlur = () => {
    const trimmed = label.trim();
    if (trimmed && trimmed !== product.label) onLabelChange(trimmed);
  };

  const handleAddStatus = () => {
    const trimmed = newStatusLabel.trim();
    if (!trimmed) return;
    onAddStatus({ name: slugify(trimmed), label: trimmed });
    setNewStatusLabel('');
  };

  return (
    <div className={`border rounded-lg p-4 space-y-3 ${preset.bgColor}`}>
      <div className="flex items-center gap-3">
        <Folder className={`w-5 h-5 ${preset.color}`} />
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={handleLabelBlur}
          className="flex-1 bg-input/50 border-border"
        />
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive"
          onClick={() => setConfirmDeleteOpen(true)}
          aria-label="Ordner löschen"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      <ColorPicker selected={product.color_token as ColorToken} onSelect={onColorChange} />

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Unterordner</Label>
        {product.statuses.map((s) => (
          <StatusRow
            key={s.id}
            status={s}
            onUpdate={(label) => onUpdateStatus(s.id, { label })}
            onDelete={() => onDeleteStatus(s.id)}
          />
        ))}
        <div className="flex gap-2">
          <Input
            placeholder="Neuer Unterordner (z.B. Wartung)"
            value={newStatusLabel}
            onChange={(e) => setNewStatusLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddStatus();
              }
            }}
            className="bg-input/50 border-border"
          />
          <Button variant="outline" size="sm" onClick={handleAddStatus}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>"{product.label}" löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Der Ordner und alle dazugehörigen Unterordner werden entfernt. Bestehende
              Kundenakten in diesem Ordner blockieren das Löschen — verschiebe sie vorher.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onDelete();
                setConfirmDeleteOpen(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatusRow({
  status,
  onUpdate,
  onDelete,
}: {
  status: CustomStatus;
  onUpdate: (label: string) => void;
  onDelete: () => void;
}) {
  const [label, setLabel] = useState(status.label);

  const handleBlur = () => {
    const trimmed = label.trim();
    if (trimmed && trimmed !== status.label) onUpdate(trimmed);
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={handleBlur}
        className="flex-1 bg-input/50 border-border text-sm"
      />
      <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Unterordner entfernen">
        <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------
// Color picker (swatches)
// ---------------------------------------------------------------
function ColorPicker({
  selected,
  onSelect,
}: {
  selected: ColorToken;
  onSelect: (token: ColorToken) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {COLOR_PRESETS.map((p) => (
        <button
          key={p.token}
          type="button"
          onClick={() => onSelect(p.token)}
          aria-label={p.label}
          className={`w-8 h-8 rounded-full ${p.swatch} transition-all ${
            selected === p.token ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background' : 'opacity-70 hover:opacity-100'
          }`}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------
// New product form
// ---------------------------------------------------------------
function NewProductForm({
  onCreate,
}: {
  onCreate: (input: {
    name: string;
    label: string;
    colorToken: ColorToken;
    statuses: { name: string; label: string }[];
  }) => Promise<void>;
}) {
  const [label, setLabel] = useState('');
  const [colorToken, setColorToken] = useState<ColorToken>('purple');
  const [statuses, setStatuses] = useState(DEFAULT_NEW_STATUSES);
  const [newStatusLabel, setNewStatusLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setLabel('');
    setColorToken('purple');
    setStatuses(DEFAULT_NEW_STATUSES);
    setNewStatusLabel('');
  };

  const handleCreate = async () => {
    const trimmed = label.trim();
    if (!trimmed || statuses.length === 0) return;
    setSubmitting(true);
    try {
      await onCreate({
        name: slugify(trimmed) || `ordner_${Date.now()}`,
        label: trimmed,
        colorToken,
        statuses,
      });
      reset();
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddStatus = () => {
    const trimmed = newStatusLabel.trim();
    if (!trimmed) return;
    setStatuses((prev) => [...prev, { name: slugify(trimmed), label: trimmed }]);
    setNewStatusLabel('');
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">Neuen Ordner anlegen</h4>

      <div className="space-y-2">
        <Label htmlFor="new-product-label">Name</Label>
        <Input
          id="new-product-label"
          placeholder="z.B. Versicherungsfälle Light"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="bg-input/50 border-border"
        />
      </div>

      <div className="space-y-2">
        <Label>Farbe</Label>
        <ColorPicker selected={colorToken} onSelect={setColorToken} />
      </div>

      <div className="space-y-2">
        <Label>Unterordner / Pipeline</Label>
        {statuses.map((s, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <Input
              value={s.label}
              onChange={(e) => {
                const next = [...statuses];
                next[idx] = { name: slugify(e.target.value), label: e.target.value };
                setStatuses(next);
              }}
              className="flex-1 bg-input/50 border-border text-sm"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setStatuses((prev) => prev.filter((_, i) => i !== idx))}
              aria-label="Unterordner entfernen"
            >
              <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
            </Button>
          </div>
        ))}
        <div className="flex gap-2">
          <Input
            placeholder="Weiteren Unterordner hinzufügen"
            value={newStatusLabel}
            onChange={(e) => setNewStatusLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddStatus();
              }
            }}
            className="bg-input/50 border-border text-sm"
          />
          <Button variant="outline" size="sm" onClick={handleAddStatus}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Button
        onClick={handleCreate}
        disabled={!label.trim() || statuses.length === 0 || submitting}
        className="w-full"
      >
        {submitting ? 'Wird erstellt…' : 'Ordner anlegen'}
      </Button>
    </div>
  );
}
