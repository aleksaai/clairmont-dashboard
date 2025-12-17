import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export function useMessageNotifications(currentUserId: string | undefined) {
  const [unreadCount, setUnreadCount] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const profilesCache = useRef<Map<string, Profile>>(new Map());

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    if (!currentUserId) return;

    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', currentUserId)
      .eq('read', false);

    setUnreadCount(count || 0);
  }, [currentUserId]);

  // Get sender profile (with caching)
  const getSenderProfile = useCallback(async (senderId: string): Promise<Profile | null> => {
    if (profilesCache.current.has(senderId)) {
      return profilesCache.current.get(senderId)!;
    }

    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .eq('id', senderId)
      .single();

    if (data) {
      profilesCache.current.set(senderId, data);
    }
    return data;
  }, []);

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQ0AF5a+2NFmEgMqfp7U5JYoBxpvnb7YrWYXCSpkhqLU05lGEgwoUnnJ1M2IQhgdLUhkn9TalWUjBQErP1eO1t2ZaSoIA0c0X4vU3qFwMBUDSTdUgM/fqXg3GQpYNFeC0OCyh0IdCF02WIbT4rWVVzIQBV0xUHXP46F4Oxy7NlyA0eSYbzYaGFxPW4XX4Jl0UxgiRFZklePBuIJKGCBXU2mZ39Ogi0MbE01LY5LcybOGVyUXUk1cj9HOop1wNC4aSkVWhdLKqIxfLBdJQVqDzc');
    }
    audioRef.current.currentTime = 0;
    audioRef.current.volume = 0.5;
    audioRef.current.play().catch(() => {});
  }, []);

  // Show toast notification
  const showNotification = useCallback(async (senderId: string, messageContent: string) => {
    const sender = await getSenderProfile(senderId);
    const senderName = sender?.full_name || 'Jemand';
    const preview = messageContent.length > 50 ? messageContent.substring(0, 50) + '...' : messageContent;

    toast(senderName, {
      description: preview,
      icon: sender?.avatar_url ? (
        <img 
          src={sender.avatar_url} 
          alt={senderName} 
          className="w-8 h-8 rounded-full object-cover"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-primary/30 flex items-center justify-center text-xs font-medium">
          {senderName.substring(0, 2).toUpperCase()}
        </div>
      ),
      position: 'bottom-right',
      duration: 5000,
    });
  }, [getSenderProfile]);

  useEffect(() => {
    if (!currentUserId) return;

    // Initial fetch
    fetchUnreadCount();

    // Subscribe to new messages
    const channel = supabase
      .channel('message-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${currentUserId}`,
        },
        (payload) => {
          const newMessage = payload.new as { sender_id: string; content: string };
          
          // Play sound
          playNotificationSound();
          
          // Show toast
          showNotification(newMessage.sender_id, newMessage.content);
          
          // Update count
          setUnreadCount((prev) => prev + 1);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${currentUserId}`,
        },
        () => {
          // Refetch count when messages are marked as read
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, fetchUnreadCount, playNotificationSound, showNotification]);

  return { unreadCount, refetchUnreadCount: fetchUnreadCount };
}
