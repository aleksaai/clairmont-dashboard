import { Button } from '@/components/ui/button';

interface FolderCardProps {
  name: string;
  count?: number;
  onClick?: () => void;
}

function FolderCard({ name, count, onClick }: FolderCardProps) {
  return (
    <div 
      onClick={onClick}
      className="bg-card/40 backdrop-blur-sm border border-border rounded-xl p-4 cursor-pointer transition-all"
    >
      {/* Folder Icon */}
      <div className="aspect-square bg-primary/20 rounded-lg mb-3 flex items-center justify-center">
        <svg 
          viewBox="0 0 80 60" 
          className="w-16 h-16 text-primary"
          fill="currentColor"
        >
          <path d="M8 10h24l6 8h34c4.4 0 8 3.6 8 8v24c0 4.4-3.6 8-8 8H8c-4.4 0-8-3.6-8-8V18c0-4.4 3.6-8 8-8z" opacity="0.3"/>
          <path d="M8 14h24l6 8h34c4.4 0 8 3.6 8 8v20c0 4.4-3.6 8-8 8H8c-4.4 0-8-3.6-8-8V22c0-4.4 3.6-8 8-8z"/>
        </svg>
      </div>
      
      <p className="text-sm font-medium text-foreground truncate">{name}</p>
      {count !== undefined && (
        <p className="text-xs text-muted-foreground mt-1">{count} Elemente</p>
      )}
    </div>
  );
}

export function OrdnerView() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Mein Drive</h2>
          <p className="text-sm text-muted-foreground">Mein Drive</p>
        </div>
        <Button size="sm" className="bg-primary text-primary-foreground">
          + Hinzufügen
        </Button>
      </div>
      
      {/* Folder Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {/* Empty State - wird später mit echten Ordnern ersetzt */}
      </div>

      {/* Empty State */}
      <div className="bg-card/40 backdrop-blur-sm border border-border rounded-xl min-h-[300px] flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground">Noch keine Ordner vorhanden</p>
          <p className="text-sm text-muted-foreground/70">
            Klicken Sie auf "Hinzufügen" um einen neuen Ordner zu erstellen
          </p>
        </div>
      </div>
    </div>
  );
}
