import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Paperclip, FileText, Image, X } from 'lucide-react';
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
  file_path?: string | null;
  file_name?: string | null;
  file_type?: string | null;
}

const ALLOWED_FILE_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function ChatsListe() {
  const { user } = useAuth();
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch all users
  useEffect(() => {
    const fetchUsers = async () => {
      if (!user) return;

      try {
        // First get current user's role
        const { data: currentRoleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();
        
        const currentRole = currentRoleData?.role;

        const { data: profiles, error } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, email')
          .neq('id', user.id);

        if (error) throw error;

        // Get roles for all profiles
        const { data: allRoles } = await supabase
          .from('user_roles')
          .select('user_id, role');

        // Filter profiles based on visibility rules
        // Vertriebler can only see admins and sachbearbeiter
        // Admins and Sachbearbeiter can see everyone
        const filteredProfiles = (profiles || []).filter(profile => {
          const profileRole = allRoles?.find(r => r.user_id === profile.id)?.role;
          
          if (currentRole === 'vertriebler') {
            return profileRole === 'admin' || profileRole === 'sachbearbeiter';
          }
          
          return true;
        });

        // Get last messages and unread counts for each user
        const usersWithMessages = await Promise.all(
          filteredProfiles.map(async (profile) => {
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      toast.error('Nur PDF, PNG und JPEG Dateien erlaubt');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error('Datei darf maximal 10MB groß sein');
      return;
    }

    setSelectedFile(file);
  };

  const uploadFile = async (file: File): Promise<{ path: string; name: string; type: string } | null> => {
    if (!user) return null;

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    const { error } = await supabase.storage
      .from('chat-attachments')
      .upload(fileName, file);

    if (error) {
      console.error('Upload error:', error);
      return null;
    }

    return {
      path: fileName,
      name: file.name,
      type: file.type,
    };
  };

  const getFileUrl = (filePath: string) => {
    const { data } = supabase.storage.from('chat-attachments').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const getSignedUrl = async (filePath: string) => {
    const { data } = await supabase.storage
      .from('chat-attachments')
      .createSignedUrl(filePath, 3600); // 1 hour
    return data?.signedUrl;
  };

  const handleSendMessage = async () => {
    if ((!messageInput.trim() && !selectedFile) || !user || !selectedUser) return;

    setUploading(true);

    try {
      let fileData = null;

      if (selectedFile) {
        fileData = await uploadFile(selectedFile);
        if (!fileData) {
          toast.error('Datei konnte nicht hochgeladen werden');
          setUploading(false);
          return;
        }
      }

      const { error } = await supabase.from('messages').insert({
        sender_id: user.id,
        receiver_id: selectedUser.id,
        content: messageInput.trim() || (fileData ? fileData.name : ''),
        file_path: fileData?.path || null,
        file_name: fileData?.name || null,
        file_type: fileData?.type || null,
      });

      if (error) {
        console.error('Error sending message:', error);
        toast.error('Nachricht konnte nicht gesendet werden');
        return;
      }

      setMessageInput('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } finally {
      setUploading(false);
    }
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
    <div className="flex flex-col md:flex-row h-[calc(100dvh-8rem)] md:h-[calc(100vh-8rem)] rounded-xl overflow-hidden border border-border">
      {/* Left: User List - Full width on mobile when no user selected, hidden when user selected */}
      <div className={`${selectedUser ? 'hidden md:flex' : 'flex'} w-full md:w-80 border-r border-border bg-card/30 flex-col`}>
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

      {/* Right: Chat Area - Full width on mobile */}
      <div className={`${selectedUser ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-h-0 bg-gradient-to-b from-primary/5 to-primary/10`}>
        {selectedUser ? (
          <>
            {/* Chat Header */}
            <div className="h-14 px-3 md:px-4 border-b border-border bg-card/50 backdrop-blur-sm flex items-center gap-3">
              {/* Back button on mobile */}
              <button 
                onClick={() => setSelectedUser(null)}
                className="md:hidden p-1.5 -ml-1 rounded-lg hover:bg-muted/50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </button>
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
            <div className="flex-1 min-h-0 overflow-y-auto p-3 md:p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground text-sm text-center px-4">
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
                        className={`max-w-[85%] md:max-w-[70%] px-3 py-2 rounded-xl ${
                          message.sender_id === user?.id
                            ? 'bg-primary text-primary-foreground rounded-br-sm'
                            : 'bg-card/80 text-foreground rounded-bl-sm'
                        }`}
                      >
                        {message.file_path && (
                          <MessageAttachment
                            filePath={message.file_path}
                            fileName={message.file_name || 'Datei'}
                            fileType={message.file_type || ''}
                            isSender={message.sender_id === user?.id}
                          />
                        )}
                        {message.content && !message.file_path && (
                          <p className="text-sm">{message.content}</p>
                        )}
                        {message.content && message.file_path && message.content !== message.file_name && (
                          <p className="text-sm mt-2">{message.content}</p>
                        )}
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
            <div className="p-2 md:p-3 border-t border-border bg-card/50 backdrop-blur-sm">
              {selectedFile && (
                <div className="mb-2 p-2 bg-muted/50 rounded-lg flex items-center gap-2">
                  {selectedFile.type.startsWith('image/') ? (
                    <Image className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <FileText className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className="text-sm text-foreground truncate flex-1">
                    {selectedFile.name}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => {
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="shrink-0"
                >
                  <Paperclip className="w-4 h-4" />
                </Button>
                <input
                  type="text"
                  placeholder="Nachricht..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                  className="flex-1 min-w-0 bg-input/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  disabled={uploading}
                />
                <Button
                  onClick={handleSendMessage}
                  size="icon"
                  className="bg-primary text-primary-foreground shrink-0"
                  disabled={(!messageInput.trim() && !selectedFile) || uploading}
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

// Component for displaying message attachments
function MessageAttachment({ 
  filePath, 
  fileName, 
  fileType, 
  isSender 
}: { 
  filePath: string; 
  fileName: string; 
  fileType: string;
  isSender: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const getUrl = async () => {
      const { data } = await supabase.storage
        .from('chat-attachments')
        .createSignedUrl(filePath, 3600);
      setUrl(data?.signedUrl || null);
    };
    getUrl();
  }, [filePath]);

  if (!url) {
    return <p className="text-sm">Lädt...</p>;
  }

  const isImage = fileType.startsWith('image/');

  if (isImage) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        <img 
          src={url} 
          alt={fileName} 
          className="max-w-full rounded-lg max-h-48 object-cover"
        />
      </a>
    );
  }

  return (
    <a 
      href={url} 
      target="_blank" 
      rel="noopener noreferrer"
      className={`flex items-center gap-2 p-2 rounded-lg ${
        isSender ? 'bg-primary-foreground/10' : 'bg-muted/50'
      }`}
    >
      <FileText className="w-5 h-5" />
      <span className="text-sm truncate">{fileName}</span>
    </a>
  );
}
