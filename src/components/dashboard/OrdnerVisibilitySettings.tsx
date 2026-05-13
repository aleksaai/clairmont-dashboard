import { Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ALL_PRODUCTS, type ProductType } from '@/hooks/useVisibleProducts';
import type { CustomProduct } from '@/hooks/useCustomProducts';
import { CustomFolderManager } from './CustomFolderManager';

interface Props {
  visibilityMap: Record<ProductType, boolean> | null;
  productLabels: Record<ProductType, string>;
  customProducts: CustomProduct[];
  customVisibilityMap: Record<string, boolean> | null;
  onToggle: (product: ProductType, next: boolean) => Promise<void>;
  onToggleCustom: (customProductId: string, next: boolean) => Promise<void>;
  isAdmin: boolean;
}

export function OrdnerVisibilitySettings({
  visibilityMap,
  productLabels,
  customProducts,
  customVisibilityMap,
  onToggle,
  onToggleCustom,
  isAdmin,
}: Props) {
  const { toast } = useToast();

  const safeRun = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch {
      toast({
        title: 'Fehler',
        description: 'Einstellung konnte nicht gespeichert werden.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="flex items-center gap-2">
      {isAdmin && <CustomFolderManager />}

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="border-border">
            <Settings2 className="w-4 h-4 mr-1 md:mr-2" />
            <span className="hidden sm:inline">Ordner verwalten</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
          <div className="p-4 border-b border-border">
            <h3 className="font-medium text-sm">Sichtbare Ordner</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Wähle, welche Kategorien im Drive angezeigt werden.
            </p>
          </div>

          <div className="p-2 max-h-96 overflow-y-auto">
            <div className="px-2 pt-1 pb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              Standard-Ordner
            </div>
            {ALL_PRODUCTS.map((product) => {
              const checked = visibilityMap?.[product] ?? false;
              return (
                <div
                  key={product}
                  className="flex items-center justify-between gap-3 px-2 py-2 rounded-md hover:bg-muted/30"
                >
                  <Label
                    htmlFor={`visibility-${product}`}
                    className="text-sm cursor-pointer flex-1"
                  >
                    {productLabels[product]}
                  </Label>
                  <Switch
                    id={`visibility-${product}`}
                    checked={checked}
                    onCheckedChange={(next) => safeRun(() => onToggle(product, next))}
                  />
                </div>
              );
            })}

            {customProducts.length > 0 && (
              <>
                <div className="px-2 pt-3 pb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                  Eigene Ordner
                </div>
                {customProducts.map((cp) => {
                  const checked = customVisibilityMap?.[cp.id] ?? true;
                  return (
                    <div
                      key={cp.id}
                      className="flex items-center justify-between gap-3 px-2 py-2 rounded-md hover:bg-muted/30"
                    >
                      <Label
                        htmlFor={`visibility-custom-${cp.id}`}
                        className="text-sm cursor-pointer flex-1"
                      >
                        {cp.label}
                      </Label>
                      <Switch
                        id={`visibility-custom-${cp.id}`}
                        checked={checked}
                        onCheckedChange={(next) => safeRun(() => onToggleCustom(cp.id, next))}
                      />
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
