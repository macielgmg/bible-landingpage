import { useNavigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionContext';
import { Navigate } from 'react-router-dom';
import { LandingPageContent } from '@/components/LandingPageContent'; // Importar o novo componente

export default function Index() {
  const { session } = useSession();

  // Se já estiver logado, redireciona para a página principal do app
  if (session) {
    return <Navigate to="/today" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <LandingPageContent />
    </div>
  );
}