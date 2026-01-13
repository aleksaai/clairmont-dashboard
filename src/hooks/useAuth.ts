import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'admin' | 'sachbearbeiter' | 'vertriebler';

interface Profile {
  full_name: string | null;
  avatar_url: string | null;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  profile: Profile | null;
  loading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    role: null,
    profile: null,
    loading: true,
  });

  const fetchUserData = async (userId: string) => {
    try {
      const [roleResult, profileResult] = await Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', userId).single(),
        supabase.from('profiles').select('full_name, avatar_url').eq('id', userId).single(),
      ]);

      setState(prev => ({
        ...prev,
        role: (roleResult.data?.role as AppRole) ?? null,
        profile: profileResult.data
          ? {
              full_name: profileResult.data.full_name,
              avatar_url: profileResult.data.avatar_url,
            }
          : null,
        loading: false,
      }));
    } catch (error) {
      console.error('fetchUserData failed:', error);
      setState(prev => ({ ...prev, role: null, profile: null, loading: false }));
    }
  };

  useEffect(() => {
    // Safety net: never block the UI forever.
    const safetyTimeout = window.setTimeout(() => {
      setState(prev => (prev.loading ? { ...prev, loading: false } : prev));
    }, 8000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setState(prev => ({
        ...prev,
        session,
        user: session?.user ?? null,
      }));

      if (session?.user) {
        // Avoid unhandled promise rejections.
        void fetchUserData(session.user.id);
      } else {
        setState(prev => ({ ...prev, role: null, profile: null, loading: false }));
      }
    });

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setState(prev => ({
          ...prev,
          session,
          user: session?.user ?? null,
        }));

        if (session?.user) {
          void fetchUserData(session.user.id);
        } else {
          setState(prev => ({ ...prev, loading: false }));
        }
      })
      .catch((error) => {
        console.error('getSession failed:', error);
        setState(prev => ({ ...prev, loading: false }));
      });

    return () => {
      window.clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);


  const refreshProfile = async () => {
    if (!state.user?.id) return;
    
    const { data } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', state.user.id)
      .single();
    
    if (data) {
      setState(prev => ({
        ...prev,
        profile: {
          full_name: data.full_name,
          avatar_url: data.avatar_url,
        },
      }));
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  return {
    user: state.user,
    session: state.session,
    role: state.role,
    profile: state.profile,
    loading: state.loading,
    signIn,
    signUp,
    signOut,
    refreshProfile,
  };
}
