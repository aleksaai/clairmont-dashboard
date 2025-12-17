import { Button } from '@/components/ui/button';

export function ChatsListe() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Chats</h2>
        <Button size="sm" className="bg-primary text-primary-foreground">
          Neuer Chat
        </Button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-[400px]">
        {/* Chat Liste */}
        <div className="bg-card/40 backdrop-blur-sm border border-border rounded-xl p-4">
          <p className="text-sm text-muted-foreground mb-4">Konversationen</p>
          <div className="flex items-center justify-center h-48">
            <p className="text-sm text-muted-foreground/70">Keine Chats</p>
          </div>
        </div>
        
        {/* Chat Bereich */}
        <div className="lg:col-span-2 bg-card/40 backdrop-blur-sm border border-border rounded-xl p-4 flex flex-col">
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground">Wählen Sie einen Chat aus</p>
          </div>
          
          {/* Message Input */}
          <div className="border-t border-border pt-4 mt-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Nachricht schreiben..."
                className="flex-1 bg-input/50 border border-border rounded-lg px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <Button size="sm" className="bg-primary text-primary-foreground">
                Senden
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
