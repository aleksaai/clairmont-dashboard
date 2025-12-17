import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import { UserAvatar } from '@/components/UserAvatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface ChatUser {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read: boolean;
}

export function ChatsListe() {
  const { user } = useAuth();
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch all users
  useEffect(() => {
    const fetchUsers = async () => {
      if (!user) return;

      try {
        const { data: profiles, error } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, email')
          .neq('id', user.id);

        if (error) throw error;

        // Get last messages and unread counts for each user
        const usersWithMessages = await Promise.all(
          (profiles || []).map(async (profile) => {
            const { data: lastMsg } = await supabase
              .from('messages')
              .select('content, created_at')
              .or(`and(sender_id.eq.${user.id},receiver_id.eq.${profile.id}),and(sender_id.eq.${profile.id},receiver_id.eq.${user.id})`)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            const { count: unreadCount } = await supabase
              .from('messages')
              .select('*', { count: 'exact', head: true })
              .eq('sender_id', profile.id)
              .eq('receiver_id', user.id)
              .eq('read', false);

            return {
              ...profile,
              lastMessage: lastMsg?.content || '',
              lastMessageTime: lastMsg?.created_at ? formatTime(lastMsg.created_at) : '',
              unreadCount: unreadCount || 0,
            };
          })
        );

        // Sort by last message time
        usersWithMessages.sort((a, b) => {
          if (!a.lastMessageTime && !b.lastMessageTime) return 0;
          if (!a.lastMessageTime) return 1;
          if (!b.lastMessageTime) return -1;
          return 0;
        });

        setUsers(usersWithMessages);
      } catch (error) {
        console.error('Error fetching users:', error);
        toast.error('Fehler beim Laden der Nutzer');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [user]);

  // Fetch messages when user is selected
  useEffect(() => {
    const fetchMessages = async () => {
      if (!user || !selectedUser) return;

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${selectedUser.id}),and(sender_id.eq.${selectedUser.id},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        return;
      }

      setMessages(data || []);

      // Mark messages as read
      await supabase
        .from('messages')
        .update({ read: true })
        .eq('sender_id', selectedUser.id)
        .eq('receiver_id', user.id)
        .eq('read', false);

      // Update unread count in users list
      setUsers(prev => prev.map(u => 
        u.id === selectedUser.id ? { ...u, unreadCount: 0 } : u
      ));
    };

    fetchMessages();
  }, [user, selectedUser]);

  // Subscribe to realtime messages
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMessage = payload.new as Message;
          
          // If message is for current conversation, add it
          if (selectedUser && 
              ((newMessage.sender_id === user.id && newMessage.receiver_id === selectedUser.id) ||
               (newMessage.sender_id === selectedUser.id && newMessage.receiver_id === user.id))) {
            setMessages(prev => [...prev, newMessage]);
            
            // Mark as read if we're the receiver
            if (newMessage.receiver_id === user.id) {
              supabase
                .from('messages')
                .update({ read: true })
                .eq('id', newMessage.id);
            }
          }

          // Update users list with new message
          setUsers(prev => prev.map(u => {
            if (u.id === newMessage.sender_id || u.id === newMessage.receiver_id) {
              const isFromOther = newMessage.sender_id !== user.id;
              const isCurrentChat = selectedUser?.id === (isFromOther ? newMessage.sender_id : newMessage.receiver_id);
              
              return {
                ...u,
                lastMessage: newMessage.content,
                lastMessageTime: formatTime(newMessage.created_at),
                unreadCount: isFromOther && !isCurrentChat ? (u.unreadCount || 0) + 1 : u.unreadCount,
              };
            }
            return u;
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, selectedUser]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Gestern';
    } else if (days < 7) {
      return date.toLocaleDateString('de-DE', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
    }
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !user || !selectedUser) return;

    const { error } = await supabase.from('messages').insert({
      sender_id: user.id,
      receiver_id: selectedUser.id,
      content: messageInput.trim(),
    });

    if (error) {
      console.error('Error sending message:', error);
      toast.error('Nachricht konnte nicht gesendet werden');
      return;
    }

    setMessageInput('');
  };

  const filteredUsers = users.filter(u => 
    u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <p className="text-muted-foreground">Lädt...</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] rounded-xl overflow-hidden border border-border">
      {/* Left: User List */}
      <div className="w-80 border-r border-border bg-card/30 flex flex-col">
        {/* Search */}
        <div className="p-3 border-b border-border">
          <input
            type="text"
            placeholder="Nutzer suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-input/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* User List */}
        <div className="flex-1 overflow-y-auto">
          {filteredUsers.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Keine Nutzer gefunden
            </div>
          ) : (
            filteredUsers.map((chatUser) => (
              <button
                key={chatUser.id}
                onClick={() => setSelectedUser(chatUser)}
                className={`w-full p-3 flex items-center gap-3 text-left transition-colors ${
                  selectedUser?.id === chatUser.id
                    ? 'bg-primary/20'
                    : 'bg-transparent hover:bg-card/50'
                }`}
              >
                <UserAvatar
                  avatarUrl={chatUser.avatar_url}
                  fullName={chatUser.full_name}
                  size="md"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground truncate">
                      {chatUser.full_name || chatUser.email}
                    </p>
                    {chatUser.lastMessageTime && (
                      <span className="text-xs text-muted-foreground">
                        {chatUser.lastMessageTime}
                      </span>
                    )}
                  </div>
                  {chatUser.lastMessage && (
                    <p className="text-xs text-muted-foreground truncate">
                      {chatUser.lastMessage}
                    </p>
                  )}
                </div>

                {(chatUser.unreadCount ?? 0) > 0 && (
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-xs font-medium text-primary-foreground">
                      {chatUser.unreadCount}
                    </span>
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right: Chat Area */}
      <div className="flex-1 flex flex-col bg-gradient-to-b from-primary/5 to-primary/10">
        {selectedUser ? (
          <>
            {/* Chat Header */}
            <div className="h-14 px-4 border-b border-border bg-card/50 backdrop-blur-sm flex items-center gap-3">
              <UserAvatar
                avatarUrl={selectedUser.avatar_url}
                fullName={selectedUser.full_name}
                size="sm"
              />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {selectedUser.full_name || selectedUser.email}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground text-sm">
                    Noch keine Nachrichten. Schreiben Sie die erste!
                  </p>
                </div>
              ) : (
                <>
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] px-3 py-2 rounded-xl ${
                          message.sender_id === user?.id
                            ? 'bg-primary text-primary-foreground rounded-br-sm'
                            : 'bg-card/80 text-foreground rounded-bl-sm'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        <p className={`text-xs mt-1 ${
                          message.sender_id === user?.id 
                            ? 'text-primary-foreground/70' 
                            : 'text-muted-foreground'
                        }`}>
                          {formatTime(message.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Message Input */}
            <div className="p-3 border-t border-border bg-card/50 backdrop-blur-sm">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nachricht schreiben..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                  className="flex-1 bg-input/50 border border-border rounded-lg px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <Button
                  onClick={handleSendMessage}
                  size="icon"
                  className="bg-primary text-primary-foreground"
                  disabled={!messageInput.trim()}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground">Wählen Sie einen Nutzer aus</p>
          </div>
        )}
      </div>
    </div>
  );
}
