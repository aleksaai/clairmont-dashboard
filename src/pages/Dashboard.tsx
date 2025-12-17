import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { StatsOverview } from '@/components/dashboard/StatsOverview';
import { MandantenListe } from '@/components/dashboard/MandantenListe';
import { OrdnerListe } from '@/components/dashboard/OrdnerListe';
import { DokumenteListe } from '@/components/dashboard/DokumenteListe';
import { ChatsListe } from '@/components/dashboard/ChatsListe';
import { AufgabenListe } from '@/components/dashboard/AufgabenListe';
import { KalenderView } from '@/components/dashboard/KalenderView';
import { BerichteView } from '@/components/dashboard/BerichteView';
import { TeamView } from '@/components/dashboard/TeamView';
import { EinstellungenView } from '@/components/dashboard/EinstellungenView';

export default function Dashboard() {
  const { user, role, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState('dashboard');

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
      case 'dashboard':
        return (
          <div className="space-y-6">
            <StatsOverview />
            <MandantenListe />
          </div>
        );
      case 'mandanten':
        return <MandantenListe />;
      case 'ordner':
        return <OrdnerListe />;
      case 'dokumente':
        return <DokumenteListe />;
      case 'chats':
        return <ChatsListe />;
      case 'aufgaben':
        return <AufgabenListe />;
      case 'kalender':
        return <KalenderView />;
      case 'berichte':
        return <BerichteView />;
      case 'team':
        return <TeamView />;
      case 'einstellungen':
        return <EinstellungenView />;
      default:
        return <MandantenListe />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} />
      
      <div className="flex-1 flex flex-col">
        <Header 
          userEmail={user?.email} 
          userRole={role} 
          onSignOut={handleSignOut} 
        />
        
        <main className="flex-1 p-6 overflow-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
