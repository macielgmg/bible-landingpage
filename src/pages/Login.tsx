import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { Navigate, useNavigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionContext';
import { Logo } from '@/components/Logo';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react'; // NOVO: Importar Loader2
// Removido: import { SignUpForm } from '@/components/SignUpForm';
import { OnboardingLoading } from '@/components/OnboardingLoading';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { logUserActivity } from '@/utils/logging';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { showError } from '@/utils/toast'; // Importar showError

const Login = () => {
  const { session, loading } = useSession();
  const navigate = useNavigate();
  
  const [currentScreen, setCurrentScreen] = useState<'emailInput' | 'signIn' | 'forgotPassword' | 'onboardingLoading' | 'welcomeScreen'>('emailInput');
  const [emailForSignIn, setEmailForSignIn] = useState('');
  const [isCheckingEmail, setIsCheckingEmail] = useState(false); // NOVO: Estado para verificar email

  // Efeito para logar o login do usuário
  useEffect(() => {
    if (session?.user) {
      logUserActivity(session.user.id, 'user_login', `Usuário ${session.user.email} logou.`);
    }
  }, [session]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-secondary/40 p-4">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // If session exists, always redirect to /today. AuthProtectedRoute will handle onboarding.
  if (session) {
    return <Navigate to="/today" replace />;
  }

  const handleOnboardingLoadingComplete = () => {
    setCurrentScreen('welcomeScreen');
  };

  const handleWelcomeScreenContinue = () => {
    navigate('/onboarding-quiz');
  };

  const handleContinueWithEmail = async () => {
    if (!emailForSignIn) {
      showError("Por favor, digite seu email.");
      return;
    }

    setIsCheckingEmail(true);
    try {
      // Verificar se o email existe na tabela authorized_users
      const { data, error } = await supabase
        .from('authorized_users')
        .select('email')
        .eq('email', emailForSignIn)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') { // PGRST116 means "no rows found"
        console.error('Erro ao verificar email em authorized_users:', error);
        showError('Ocorreu um erro ao verificar seu email. Tente novamente.');
        return;
      }

      if (!data) {
        showError('Este email não está autorizado a acessar o aplicativo. Por favor, entre em contato com o suporte.');
        return;
      }

      // Se o email está autorizado, prossegue para a tela de login
      setCurrentScreen('signIn');
    } catch (err) {
      console.error('Erro inesperado ao verificar email:', err);
      showError('Ocorreu um erro inesperado.');
    } finally {
      setIsCheckingEmail(false);
    }
  };

  const renderAuthComponent = (view: 'sign_in' | 'forgotten_password', initialEmail?: string) => (
    <div className="w-full max-w-md rounded-lg bg-card p-8 shadow-lg relative animate-fade-in">
      <Button 
        variant="ghost" 
        size="icon" 
        className="absolute top-4 left-4 text-muted-foreground hover:text-primary"
        onClick={() => setCurrentScreen('emailInput')}
      >
        <ArrowLeft className="h-5 w-5" />
      </Button>
      <Auth
        supabaseClient={supabase}
        providers={[]}
        appearance={{
          theme: ThemeSupa,
          variables: {
            default: {
              colors: {
                brand: 'hsl(120 10% 20%)',
                brandAccent: 'hsl(120 10% 15%)',
                brandButtonText: 'hsl(120 20% 95%)',
                inputBackground: 'hsl(var(--input))',
                inputBorder: 'hsl(var(--border))',
                inputText: 'hsl(var(--foreground))',
              },
              radii: {
                borderRadiusButton: '0.5rem',
                inputBorderRadius: '0.5rem',
              },
            },
          },
        }}
        theme="light"
        view={view}
        showLinks={false} // Mantido para esconder links de signup/forgot password internos do Auth
        localization={{
          variables: {
            sign_in: {
              email_label: 'Email',
              password_label: 'Senha',
              button_label: 'Entrar',
              email_input_placeholder: 'Seu endereço de email',
              password_input_placeholder: 'Sua senha',
              link_text: 'Esqueceu sua senha?',
            },
            // Removido o bloco sign_up
            forgotten_password: {
              email_label: 'Email',
              password_label: 'Sua senha', 
              button_label: 'Enviar instruções de redefinição',
              link_text: 'Esqueceu sua senha?', 
              email_input_placeholder: 'Seu endereço de email',
            },
          },
        }}
        email={initialEmail} 
      />
      {view === 'sign_in' && (
        <Button 
          variant="link" 
          className="w-full mt-4 text-primary" 
          onClick={() => setCurrentScreen('forgotPassword')}
        >
          Esqueceu sua senha?
        </Button>
      )}
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-secondary/40 p-4">
      <div className="mb-8 text-center animate-fade-in-up animation-delay-100">
        <Logo />
        <p className="mt-2 text-muted-foreground">Aprofunde-se na Palavra de Deus.</p>
      </div>

      {currentScreen === 'emailInput' && (
        <div className="w-full max-w-md rounded-lg bg-card p-8 shadow-lg flex flex-col items-center space-y-4 animate-fade-in">
          <h2 className="text-2xl font-bold text-primary animate-fade-in-up animation-delay-200">Bem-vindo ao Raízes da Fé</h2>
          <p className="text-muted-foreground text-center mb-4 animate-fade-in-up animation-delay-300">
            Para continuar, digite seu email.
          </p>
          <div className="w-full space-y-2 animate-fade-in-up animation-delay-400">
            <Label htmlFor="email-input">Email</Label>
            <Input
              id="email-input"
              type="email"
              placeholder="Seu endereço de email"
              value={emailForSignIn}
              onChange={(e) => setEmailForSignIn(e.target.value)}
              className="w-full"
            />
          </div>
          <Button 
            onClick={handleContinueWithEmail} 
            className="w-full py-6 text-lg animate-fade-in-up animation-delay-500"
            disabled={!emailForSignIn || isCheckingEmail}
          >
            {isCheckingEmail ? <Loader2 className="h-6 w-6 animate-spin" /> : "Continuar com Email"}
          </Button>
        </div>
      )}

      {currentScreen === 'signIn' && renderAuthComponent('sign_in', emailForSignIn)}
      {currentScreen === 'forgotPassword' && renderAuthComponent('forgotten_password', emailForSignIn)}
      {currentScreen === 'onboardingLoading' && (
        <OnboardingLoading onComplete={handleOnboardingLoadingComplete} />
      )}
      {currentScreen === 'welcomeScreen' && (
        <WelcomeScreen onContinue={handleWelcomeScreenContinue} />
      )}
    </div>
  );
};

export default Login;