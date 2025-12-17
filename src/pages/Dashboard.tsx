import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Header } from '@/components/layout/Header';
import { OrdnerView } from '@/components/dashboard/OrdnerView';
import { ChatsListe } from '@/components/dashboard/ChatsListe';
import { TeamView } from '@/components/dashboard/TeamView';
import { EinstellungenView } from '@/components/dashboard/EinstellungenView';

export default function Dashboard() {
  const { user, role, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState('ordner');

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
        return <OrdnerView />;
      case 'chats':
        return <ChatsListe />;
      case 'team':
        return <TeamView />;
      case 'einstellungen':
        return <EinstellungenView />;
      default:
        return <OrdnerView />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header 
        userEmail={user?.email} 
        userRole={role}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        onSignOut={handleSignOut} 
      />
      
      <main className="flex-1 p-6 overflow-auto">
        {renderContent()}
      </main>
    </div>
  );
}
