import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';

interface ChatContact {
  id: string;
  name: string;
  lastMessage: string;
  timestamp: string;
  unread?: number;
  online?: boolean;
}

interface Message {
  id: string;
  senderId: string;
  content: string;
  timestamp: string;
  isOwn: boolean;
}

const mockContacts: ChatContact[] = [
  { id: '1', name: 'Allgemeiner Chat', lastMessage: 'Willkommen im Team!', timestamp: '14:30', unread: 2 },
  { id: '2', name: 'Max Mustermann', lastMessage: 'Dokumente sind bereit', timestamp: '12:15', online: true },
  { id: '3', name: 'Anna Schmidt', lastMessage: 'Termin bestätigt', timestamp: 'Gestern' },
  { id: '4', name: 'Peter Weber', lastMessage: 'Danke für die Info', timestamp: 'Mo' },
];

const mockMessages: Message[] = [
  { id: '1', senderId: '2', content: 'Hallo, wie geht es dir?', timestamp: '14:20', isOwn: false },
  { id: '2', senderId: 'me', content: 'Gut, danke! Und dir?', timestamp: '14:22', isOwn: true },
  { id: '3', senderId: '2', content: 'Die Dokumente sind jetzt bereit zur Überprüfung.', timestamp: '14:25', isOwn: false },
  { id: '4', senderId: 'me', content: 'Super, ich schaue mir das gleich an.', timestamp: '14:30', isOwn: true },
];

const getInitials = (name: string) => {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

export function ChatsListe() {
  const [selectedChat, setSelectedChat] = useState<string | null>('1');
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const selectedContact = mockContacts.find(c => c.id === selectedChat);

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;
    // TODO: Implement actual message sending
    setMessageInput('');
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] rounded-xl overflow-hidden border border-border">
      {/* Left: Chat List */}
      <div className="w-80 border-r border-border bg-card/30 flex flex-col">
        {/* Search */}
        <div className="p-3 border-b border-border">
          <input
            type="text"
            placeholder="Chat suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-input/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Contact List */}
        <div className="flex-1 overflow-y-auto">
          {mockContacts.map((contact) => (
            <button
              key={contact.id}
              onClick={() => setSelectedChat(contact.id)}
              className={`w-full p-3 flex items-center gap-3 text-left transition-colors ${
                selectedChat === contact.id
                  ? 'bg-primary/20'
                  : 'bg-transparent'
              }`}
            >
              {/* Avatar */}
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-primary/30 flex items-center justify-center">
                  <span className="text-sm font-medium text-foreground">
                    {getInitials(contact.name)}
                  </span>
                </div>
                {contact.online && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-card" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground truncate">{contact.name}</p>
                  <span className="text-xs text-muted-foreground">{contact.timestamp}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{contact.lastMessage}</p>
              </div>

              {/* Unread Badge */}
              {contact.unread && (
                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-xs font-medium text-primary-foreground">{contact.unread}</span>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Right: Chat Area */}
      <div className="flex-1 flex flex-col bg-gradient-to-b from-primary/5 to-primary/10">
        {selectedContact ? (
          <>
            {/* Chat Header */}
            <div className="h-14 px-4 border-b border-border bg-card/50 backdrop-blur-sm flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/30 flex items-center justify-center">
                <span className="text-sm font-medium text-foreground">
                  {getInitials(selectedContact.name)}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{selectedContact.name}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedContact.online ? 'Online' : 'Offline'}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* Date Divider */}
              <div className="flex justify-center">
                <span className="px-3 py-1 rounded-full bg-card/60 text-xs text-muted-foreground">
                  Heute
                </span>
              </div>

              {mockMessages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.isOwn ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] px-3 py-2 rounded-xl ${
                      message.isOwn
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-card/80 text-foreground rounded-bl-sm'
                    }`}
                  >
                    <p className="text-sm">{message.content}</p>
                    <p className={`text-xs mt-1 ${message.isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                      {message.timestamp}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Message Input */}
            <div className="p-3 border-t border-border bg-card/50 backdrop-blur-sm">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nachricht schreiben..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="flex-1 bg-input/50 border border-border rounded-lg px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <Button 
                  onClick={handleSendMessage} 
                  size="icon"
                  className="bg-primary text-primary-foreground"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground">Wählen Sie einen Chat aus</p>
          </div>
        )}
      </div>
    </div>
  );
}
