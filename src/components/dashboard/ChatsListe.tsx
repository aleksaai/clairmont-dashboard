import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Send, Paperclip, FileText, Image, X, Search, ChevronUp, ChevronDown, Download, ArrowLeft } from 'lucide-react';
import { UserAvatar } from '@/components/UserAvatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';

interface ChatUser {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string;
  lastMessage?: string;
  lastMessageTime?: string;
  lastMessageTimestamp?: string; // Raw ISO timestamp for sorting
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
  const isMobile = useIsMobile();
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [showChatSearch, setShowChatSearch] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesContentRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatSearchInputRef = useRef<HTMLInputElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const stickToBottomRef = useRef(true);
  const prevMessagesLengthRef = useRef(0);
  const initialScrollDoneRef = useRef(false);
  const conversationKeyRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const userScrolledRef = useRef(false);
  const programmaticScrollRef = useRef(false);
  const lockBottomUntilRef = useRef(0);

  // Close chat search when switching users on mobile
  useEffect(() => {
    if (isMobile && !selectedUser) {
      setShowChatSearch(false);
      setChatSearchQuery('');
    }
  }, [selectedUser, isMobile]);

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
              lastMessageTimestamp: lastMsg?.created_at || '',
              unreadCount: unreadCount || 0,
            };
          })
        );

        // Sort by: 1) Unread messages first, 2) Then by last message timestamp
        usersWithMessages.sort((a, b) => {
          // First: Unread messages at top
          const aUnread = (a.unreadCount || 0) > 0 ? 1 : 0;
          const bUnread = (b.unreadCount || 0) > 0 ? 1 : 0;
          if (bUnread !== aUnread) return bUnread - aUnread;
          
          // Second: Sort by last message timestamp
          if (!a.lastMessageTimestamp && !b.lastMessageTimestamp) return 0;
          if (!a.lastMessageTimestamp) return 1;
          if (!b.lastMessageTimestamp) return -1;
          return new Date(b.lastMessageTimestamp).getTime() - new Date(a.lastMessageTimestamp).getTime();
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

          // Update users list with new message and re-sort
          setUsers(prev => {
            const updated = prev.map(u => {
              if (u.id === newMessage.sender_id || u.id === newMessage.receiver_id) {
                const isFromOther = newMessage.sender_id !== user.id;
                const isCurrentChat = selectedUser?.id === (isFromOther ? newMessage.sender_id : newMessage.receiver_id);
                
                return {
                  ...u,
                  lastMessage: newMessage.content,
                  lastMessageTime: formatTime(newMessage.created_at),
                  lastMessageTimestamp: newMessage.created_at,
                  unreadCount: isFromOther && !isCurrentChat ? (u.unreadCount || 0) + 1 : u.unreadCount,
                };
              }
              return u;
            });
            
            // Re-sort: Unread first, then by timestamp
            return updated.sort((a, b) => {
              const aUnread = (a.unreadCount || 0) > 0 ? 1 : 0;
              const bUnread = (b.unreadCount || 0) > 0 ? 1 : 0;
              if (bUnread !== aUnread) return bUnread - aUnread;
              
              if (!a.lastMessageTimestamp && !b.lastMessageTimestamp) return 0;
              if (!a.lastMessageTimestamp) return 1;
              if (!b.lastMessageTimestamp) return -1;
              return new Date(b.lastMessageTimestamp).getTime() - new Date(a.lastMessageTimestamp).getTime();
            });
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, selectedUser]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const el = messagesContainerRef.current;
    if (!el) return;
    programmaticScrollRef.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior });
    // Reset after scroll completes
    requestAnimationFrame(() => {
      programmaticScrollRef.current = false;
    });
  }, []);

  const isAtBottom = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return true;
    const threshold = 64;
    return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }, []);

  const handleMessagesScroll = useCallback(() => {
    if (chatSearchQuery.trim()) return;
    // Ignore programmatic scrolls
    if (programmaticScrollRef.current) return;
    
    // If we're in the lock period and user hasn't explicitly scrolled, keep at bottom
    if (Date.now() < lockBottomUntilRef.current && !userScrolledRef.current) {
      if (!isAtBottom()) {
        scrollToBottom('auto');
      }
      return;
    }
    
    // Only change sticky state if user has actually interacted
    if (userScrolledRef.current) {
      stickToBottomRef.current = isAtBottom();
    }
  }, [chatSearchQuery, isAtBottom, scrollToBottom]);

  // Detect actual user scroll interactions
  const handleUserScrollIntent = useCallback(() => {
    userScrolledRef.current = true;
  }, []);

  // Reset scroll state when switching conversations
  useEffect(() => {
    if (!selectedUser) return;
    stickToBottomRef.current = true;
    initialScrollDoneRef.current = false;
    prevMessagesLengthRef.current = 0;
    userScrolledRef.current = false;
    lockBottomUntilRef.current = Date.now() + 1500; // Lock for 1.5s after opening
    messageRefs.current.clear();
  }, [selectedUser?.id]);

  // Initial scroll to bottom when opening a conversation / first load of messages
  useLayoutEffect(() => {
    if (!selectedUser) return;
    if (chatSearchQuery.trim()) return;
    if (messages.length === 0) return;

    const convKey = `${user?.id ?? 'anon'}:${selectedUser.id}`;
    if (conversationKeyRef.current !== convKey) {
      conversationKeyRef.current = convKey;
      initialScrollDoneRef.current = false;
      prevMessagesLengthRef.current = 0;
      stickToBottomRef.current = true;
      messageRefs.current.clear();
    }

    if (!initialScrollDoneRef.current) {
      scrollToBottom('auto');
      initialScrollDoneRef.current = true;
      stickToBottomRef.current = true;
    }
  }, [selectedUser?.id, messages.length, chatSearchQuery]);

  // Keep bottom stuck when content resizes (e.g. images/signature URLs load)
  useEffect(() => {
    const target = messagesContentRef.current;
    if (!target) return;

    const ro = new ResizeObserver(() => {
      if (!chatSearchQuery.trim() && stickToBottomRef.current) {
        scrollToBottom('auto');
      }
    });

    ro.observe(target);
    return () => ro.disconnect();
  }, [chatSearchQuery]);

  // Smooth scroll for new messages when user is already at bottom
  useEffect(() => {
    if (!selectedUser) return;
    if (chatSearchQuery.trim()) return;

    if (messages.length > prevMessagesLengthRef.current && stickToBottomRef.current) {
      scrollToBottom('smooth');
    }

    prevMessagesLengthRef.current = messages.length;
  }, [messages.length, chatSearchQuery, selectedUser?.id]);

  // Get matching message IDs
  const getMatchingMessageIds = () => {
    if (!chatSearchQuery.trim()) return [];
    return messages
      .filter(msg => 
        msg.content.toLowerCase().includes(chatSearchQuery.toLowerCase()) ||
        msg.file_name?.toLowerCase().includes(chatSearchQuery.toLowerCase())
      )
      .map(msg => msg.id);
  };

  // Scroll to current match when search query or match index changes
  useEffect(() => {
    const matchingIds = getMatchingMessageIds();
    if (matchingIds.length > 0 && chatSearchQuery.trim()) {
      const validIndex = Math.min(currentMatchIndex, matchingIds.length - 1);
      if (validIndex !== currentMatchIndex) {
        setCurrentMatchIndex(validIndex);
      }
      const targetId = matchingIds[validIndex];
      const element = messageRefs.current.get(targetId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [chatSearchQuery, currentMatchIndex, messages]);

  // Reset match index when search query changes
  useEffect(() => {
    setCurrentMatchIndex(0);
  }, [chatSearchQuery]);

  const navigateMatch = (direction: 'prev' | 'next') => {
    const matchingIds = getMatchingMessageIds();
    if (matchingIds.length === 0) return;
    
    if (direction === 'next') {
      setCurrentMatchIndex(prev => (prev + 1) % matchingIds.length);
    } else {
      setCurrentMatchIndex(prev => (prev - 1 + matchingIds.length) % matchingIds.length);
    }
  };

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
            filteredUsers.map((chatUser) => {
              const hasUnread = (chatUser.unreadCount ?? 0) > 0;
              return (
                <button
                  key={chatUser.id}
                  onClick={() => setSelectedUser(chatUser)}
                  className={`w-full p-3 flex items-center gap-3 text-left transition-colors relative ${
                    selectedUser?.id === chatUser.id
                      ? 'bg-primary/20'
                      : hasUnread
                        ? 'bg-primary/10 hover:bg-primary/15'
                        : 'bg-transparent hover:bg-card/50'
                  }`}
                >
                  {/* Unread indicator line on the left */}
                  {hasUnread && (
                    <div className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-primary" />
                  )}

                  <UserAvatar
                    avatarUrl={chatUser.avatar_url}
                    fullName={chatUser.full_name}
                    size="md"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={`text-sm truncate ${
                        hasUnread 
                          ? 'font-bold text-foreground' 
                          : 'font-medium text-foreground'
                      }`}>
                        {chatUser.full_name || chatUser.email}
                      </p>
                      {chatUser.lastMessageTime && (
                        <span className={`text-xs shrink-0 ml-2 ${
                          hasUnread 
                            ? 'text-primary font-medium' 
                            : 'text-muted-foreground'
                        }`}>
                          {chatUser.lastMessageTime}
                        </span>
                      )}
                    </div>
                    {chatUser.lastMessage && (
                      <p className={`text-xs truncate ${
                        hasUnread 
                          ? 'font-semibold text-foreground/80' 
                          : 'text-muted-foreground'
                      }`}>
                        {chatUser.lastMessage}
                      </p>
                    )}
                  </div>

                  {hasUnread && (
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                      <span className="text-xs font-medium text-primary-foreground">
                        {chatUser.unreadCount}
                      </span>
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right: Chat Area - Full width on mobile */}
      <div className={`${selectedUser ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-h-0 bg-gradient-to-b from-primary/5 to-primary/10`}>
        {selectedUser ? (
          <>
            {/* Chat Header */}
            <div className="border-b border-border bg-card/50 backdrop-blur-sm shrink-0">
              {/* Mobile: Separate search mode vs normal header */}
              {isMobile && showChatSearch ? (
                // Mobile Search Header - Full width search input
                <div className="flex items-center gap-2 p-2 h-14">
                  <button
                    onClick={() => {
                      setShowChatSearch(false);
                      setChatSearchQuery('');
                    }}
                    className="p-2 rounded-lg hover:bg-muted/50 shrink-0"
                    aria-label="Suche schließen"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="relative flex-1">
                    <input
                      ref={chatSearchInputRef}
                      type="text"
                      placeholder="Nachrichten durchsuchen..."
                      value={chatSearchQuery}
                      onChange={(e) => setChatSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          navigateMatch(e.shiftKey ? 'prev' : 'next');
                        }
                      }}
                      className="w-full bg-input/50 border border-border rounded-lg px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      autoFocus
                    />
                  </div>
                  {chatSearchQuery && (
                    <button
                      onClick={() => setChatSearchQuery('')}
                      className="p-2 rounded-lg hover:bg-muted/50 shrink-0"
                      aria-label="Suche löschen"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ) : (
                // Normal Header
                <div className="h-14 px-2 md:px-4 flex items-center gap-2 md:gap-3">
                  {/* Back button on mobile */}
                  <button 
                    onClick={() => {
                      setSelectedUser(null);
                      setChatSearchQuery('');
                      setShowChatSearch(false);
                    }}
                    className="md:hidden p-2 -ml-1 rounded-lg hover:bg-muted/50 active:bg-muted/70 transition-colors"
                    aria-label="Zurück"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <UserAvatar
                    avatarUrl={selectedUser.avatar_url}
                    fullName={selectedUser.full_name}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {selectedUser.full_name || selectedUser.email}
                    </p>
                  </div>
                  {/* Search toggle button */}
                  <button
                    onClick={() => {
                      setShowChatSearch(true);
                      setTimeout(() => chatSearchInputRef.current?.focus(), 100);
                    }}
                    className="p-2 rounded-lg hover:bg-muted/50 active:bg-muted/70 text-muted-foreground transition-colors"
                    aria-label="Chat durchsuchen"
                  >
                    <Search className="w-5 h-5" />
                  </button>
                </div>
              )}

              {/* Mobile: Search navigation bar when searching */}
              {isMobile && showChatSearch && chatSearchQuery && (
                <div className="flex items-center justify-between px-3 pb-2 border-t border-border/50 pt-2">
                  <span className="text-sm text-muted-foreground">
                    {getMatchingMessageIds().length > 0 
                      ? `${currentMatchIndex + 1} von ${getMatchingMessageIds().length} Treffer`
                      : 'Keine Treffer'
                    }
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => navigateMatch('prev')}
                      className="p-2 rounded-lg hover:bg-muted/50 active:bg-muted/70 disabled:opacity-40 transition-colors"
                      disabled={getMatchingMessageIds().length === 0}
                      aria-label="Vorheriger Treffer"
                    >
                      <ChevronUp className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => navigateMatch('next')}
                      className="p-2 rounded-lg hover:bg-muted/50 active:bg-muted/70 disabled:opacity-40 transition-colors"
                      disabled={getMatchingMessageIds().length === 0}
                      aria-label="Nächster Treffer"
                    >
                      <ChevronDown className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Desktop: Search input below header */}
              {!isMobile && showChatSearch && (
                <div className="px-3 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        ref={chatSearchInputRef}
                        type="text"
                        placeholder="Nachrichten durchsuchen..."
                        value={chatSearchQuery}
                        onChange={(e) => setChatSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            navigateMatch(e.shiftKey ? 'prev' : 'next');
                          }
                        }}
                        className="w-full bg-input/50 border border-border rounded-lg pl-9 pr-24 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      {chatSearchQuery && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">
                            {getMatchingMessageIds().length > 0 
                              ? `${currentMatchIndex + 1}/${getMatchingMessageIds().length}`
                              : '0/0'
                            }
                          </span>
                          <button
                            onClick={() => navigateMatch('prev')}
                            className="p-0.5 rounded hover:bg-muted/50 disabled:opacity-50"
                            disabled={getMatchingMessageIds().length === 0}
                          >
                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          </button>
                          <button
                            onClick={() => navigateMatch('next')}
                            className="p-0.5 rounded hover:bg-muted/50 disabled:opacity-50"
                            disabled={getMatchingMessageIds().length === 0}
                          >
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          </button>
                          <button
                            onClick={() => setChatSearchQuery('')}
                            className="p-0.5 rounded hover:bg-muted/50"
                          >
                            <X className="w-3 h-3 text-muted-foreground" />
                          </button>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setShowChatSearch(false);
                        setChatSearchQuery('');
                      }}
                      className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Messages */}
            <div
              ref={messagesContainerRef}
              onScroll={handleMessagesScroll}
              onWheel={handleUserScrollIntent}
              onTouchStart={handleUserScrollIntent}
              onPointerDown={handleUserScrollIntent}
              style={{ overflowAnchor: 'none' }}
              className="flex-1 min-h-0 overflow-y-auto p-3 md:p-4"
            >
              <div ref={messagesContentRef} className="space-y-3">
                {(() => {
                  const matchingIds = getMatchingMessageIds();

                  if (messages.length === 0) {
                    return (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-muted-foreground text-sm text-center px-4">
                          Noch keine Nachrichten. Schreiben Sie die erste!
                        </p>
                      </div>
                    );
                  }

                  return (
                    <>
                      {messages.map((message) => {
                        const isMatch = matchingIds.includes(message.id);
                        const isCurrentMatch = isMatch && matchingIds[currentMatchIndex] === message.id;

                        return (
                          <div
                            key={message.id}
                            ref={(el) => {
                              if (el) {
                                messageRefs.current.set(message.id, el);
                              } else {
                                messageRefs.current.delete(message.id);
                              }
                            }}
                            className={`flex ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[85%] md:max-w-[70%] px-3 py-2 rounded-xl transition-all duration-200 ${
                                message.sender_id === user?.id
                                  ? 'bg-primary text-primary-foreground rounded-br-sm'
                                  : 'bg-card/80 text-foreground rounded-bl-sm'
                              } ${isCurrentMatch ? 'ring-2 ring-ring shadow-md' : ''} ${isMatch && !isCurrentMatch ? 'ring-1 ring-ring/50' : ''}`}
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
                              <p
                                className={`text-xs mt-1 ${
                                  message.sender_id === user?.id
                                    ? 'text-primary-foreground/70'
                                    : 'text-muted-foreground'
                                }`}
                              >
                                {formatTime(message.created_at)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Message Input */}
            <div className="p-2 md:p-3 border-t border-border bg-card/50 backdrop-blur-sm shrink-0">
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
              <div className="flex gap-2 items-center">
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
                  className="shrink-0 h-10 w-10 md:h-9 md:w-9"
                >
                  <Paperclip className="w-5 h-5 md:w-4 md:h-4" />
                </Button>
                <input
                  type="text"
                  placeholder="Nachricht..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                  className="flex-1 min-w-0 bg-input/50 border border-border rounded-lg px-3 py-2.5 md:py-2 text-base md:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  disabled={uploading}
                />
                <Button
                  onClick={handleSendMessage}
                  size="icon"
                  className="bg-primary text-primary-foreground shrink-0 h-10 w-10 md:h-9 md:w-9"
                  disabled={(!messageInput.trim() && !selectedFile) || uploading}
                >
                  <Send className="w-5 h-5 md:w-4 md:h-4" />
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
  isSender,
}: {
  filePath: string;
  fileName: string;
  fileType: string;
  isSender: boolean;
}) {
  const isImage = fileType.startsWith('image/');
  const [url, setUrl] = useState<string | null>(null);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const shouldFetchUrl = !isImage || open;
    if (!shouldFetchUrl) return;

    let cancelled = false;
    setIsLoadingUrl(true);

    supabase.storage
      .from('chat-attachments')
      .createSignedUrl(filePath, 3600)
      .then(({ data, error }) => {
        if (cancelled) return;

        if (error) {
          console.error('Error creating signed URL:', error);
          setUrl(null);
        } else {
          setUrl(data?.signedUrl ?? null);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingUrl(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filePath, isImage, open]);

  const attachmentContainerClass = `flex items-center gap-2 p-2 rounded-lg w-full ${
    isSender ? 'bg-primary-foreground/10' : 'bg-muted/50'
  }`;

  // Images are NOT rendered inline to avoid scroll jumps when they load.
  // Instead, we show an “image file” tile and load the actual image only when opened.
  if (isImage) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button
            type="button"
            className={attachmentContainerClass}
            aria-label="Bild öffnen"
          >
            <Image className="w-5 h-5 shrink-0" />
            <span className="text-sm">Bild</span>
            <span className={`text-xs ${isSender ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
              Ansehen
            </span>
          </button>
        </DialogTrigger>

        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="break-all">{fileName}</DialogTitle>
          </DialogHeader>

          <div className="flex justify-center">
            {isLoadingUrl ? (
              <p className="text-sm text-muted-foreground">Lädt…</p>
            ) : url ? (
              <img
                src={url}
                alt={fileName}
                className="max-h-[70vh] w-auto max-w-full rounded-md"
                loading="eager"
              />
            ) : (
              <p className="text-sm text-muted-foreground">Bild konnte nicht geladen werden.</p>
            )}
          </div>

          {url && (
            <DialogFooter className="gap-2 sm:gap-2">
              <Button 
                variant="secondary" 
                onClick={async () => {
                  try {
                    const response = await fetch(url);
                    const blob = await response.blob();
                    const blobUrl = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = blobUrl;
                    link.download = fileName;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    window.URL.revokeObjectURL(blobUrl);
                  } catch (error) {
                    console.error('Download failed:', error);
                  }
                }}
              >
                <Download className="w-4 h-4 mr-2" />
                Herunterladen
              </Button>
              <Button variant="secondary" asChild>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  In neuem Tab öffnen
                </a>
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  if (!url) {
    return <p className="text-sm">Lädt...</p>;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={attachmentContainerClass}
    >
      <FileText className="w-5 h-5 shrink-0" />
      <span className="text-sm truncate">{fileName}</span>
    </a>
  );
}
