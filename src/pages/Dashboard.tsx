import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useMessageNotifications } from '@/hooks/useMessageNotifications';
import { Header } from '@/components/layout/Header';
import { OrdnerView } from '@/components/dashboard/OrdnerView';
import { ChatsListe } from '@/components/dashboard/ChatsListe';
import { TeamView } from '@/components/dashboard/TeamView';
import { EinstellungenView } from '@/components/dashboard/EinstellungenView';
import { KnowledgeBaseView } from '@/components/dashboard/KnowledgeBaseView';
import { ProvisionsrechnerView } from '@/components/dashboard/ProvisionsrechnerView';

export default function Dashboard() {
  const { user, role, profile, loading, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState('ordner');
  const [searchContext, setSearchContext] = useState<{ folderId?: string; userId?: string } | null>(null);
  const { unreadCount } = useMessageNotifications(user?.id);

  const handleNavigate = (section: string, context?: { folderId?: string; userId?: string }) => {
    setSearchContext(context || null);
    setActiveSection(section);
  };

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast({
        title: 'Fehler beim Abmelden',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      navigate('/auth');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Laden...</p>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeSection) {
      case 'ordner':
        return <OrdnerView searchFolderId={searchContext?.folderId} onSearchConsumed={() => setSearchContext(null)} />;
      case 'chats':
        return <ChatsListe searchUserId={searchContext?.userId} onSearchConsumed={() => setSearchContext(null)} />;
      case 'team':
        return <TeamView />;
      case 'kb':
        return <KnowledgeBaseView />;
      case 'provision':
        return <ProvisionsrechnerView />;
      case 'einstellungen':
        return (
          <EinstellungenView
            userName={profile?.full_name ?? null}
            userEmail={user?.email}
            avatarUrl={profile?.avatar_url}
            userId={user?.id}
            userRole={role}
            onProfileUpdate={refreshProfile}
          />
        );
      default:
        return <OrdnerView />;
    }
  };

  return (
    <div className="min-h-screen bg-mesh flex flex-col">
      <Header
        userName={profile?.full_name ?? null}
        userRole={role}
        avatarUrl={profile?.avatar_url}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        onNavigate={handleNavigate}
        onSignOut={handleSignOut}
        unreadMessageCount={unreadCount}
      />

      <main className="flex-1 p-4 md:p-6 overflow-auto">
        {renderContent()}
      </main>
    </div>
  );
}
