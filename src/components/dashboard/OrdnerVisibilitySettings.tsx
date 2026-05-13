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

interface Props {
  visibilityMap: Record<ProductType, boolean> | null;
  productLabels: Record<ProductType, string>;
  onToggle: (product: ProductType, next: boolean) => Promise<void>;
}

export function OrdnerVisibilitySettings({ visibilityMap, productLabels, onToggle }: Props) {
  const { toast } = useToast();

  const handleToggle = async (product: ProductType, next: boolean) => {
    try {
      await onToggle(product, next);
    } catch {
      toast({
        title: 'Fehler',
        description: 'Einstellung konnte nicht gespeichert werden.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="border-border">
          <Settings2 className="w-4 h-4 mr-1 md:mr-2" />
          <span className="hidden sm:inline">Ordner verwalten</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <div className="p-4 border-b border-border">
          <h3 className="font-medium text-sm">Sichtbare Ordner</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Wähle, welche Kategorien im Drive angezeigt werden.
          </p>
        </div>
        <div className="p-2 max-h-80 overflow-y-auto">
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
                  onCheckedChange={(next) => handleToggle(product, next)}
                />
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
