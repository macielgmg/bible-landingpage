import { useSession } from '@/contexts/SessionContext';
import { Navigate, useLocation } from 'react-router-dom';
import { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface AuthProtectedRouteProps {
  children: ReactNode;
}

const AuthProtectedRoute = ({ children }: AuthProtectedRouteProps) => {
  const { session, loading: sessionLoading, onboardingCompleted, passwordChanged, isAuthorized } = useSession(); // Adicionado isAuthorized
  const location = useLocation();

  if (sessionLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando sessão...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    // Se não estiver logado, redireciona para a página de login
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // NOVO: Se o usuário está logado, mas não está autorizado, redireciona para o login
  // (A SessionContext já deveria ter deslogado, mas é uma camada extra de segurança)
  if (!isAuthorized) {
    console.log('AuthProtectedRoute: Usuário logado, mas não autorizado. Redirecionando para login.');
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Se o usuário está logado, mas a senha não foi alterada, redireciona para a página de definição de senha
  if (!passwordChanged && location.pathname !== '/set-new-password') {
    return <Navigate to="/set-new-password" replace state={{ from: location }} />;
  }

  if (!onboardingCompleted && location.pathname !== '/onboarding-quiz') {
    // Se logado, mas o onboarding não foi concluído, redireciona para o quiz de onboarding
    return <Navigate to="/onboarding-quiz" replace state={{ from: location }} />;
  }

  return children;
};

export default AuthProtectedRoute;