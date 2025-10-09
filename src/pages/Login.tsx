import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { Navigate, useNavigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionContext';
import { Logo } from '@/components/Logo';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Lock } from 'lucide-react'; // Adicionado Lock
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { showError, showSuccess } from '@/utils/toast';
import { UnauthorizedEmailModal } from "@/components/UnauthorizedEmailModal";
import { useForm } from 'react-hook-form'; // Adicionado useForm
import { zodResolver } from '@hookform/resolvers/zod'; // Adicionado zodResolver
import * as z from 'zod'; // Adicionado z
import { // Adicionado Form components
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'; // Adicionado Card components

// Esquema de validação para a nova senha
const newPasswordSchema = z.object({
  newPassword: z.string().min(6, "A nova senha deve ter pelo menos 6 caracteres."),
  confirmNewPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: "As senhas não coincidem.",
  path: ["confirmNewPassword"],
});

type NewPasswordFormValues = z.infer<typeof newPasswordSchema>;

const Login = () => {
  const { session, loading, refetchProfile } = useSession(); // Adicionado refetchProfile
  const navigate = useNavigate();
  
  const [currentScreen, setCurrentScreen] = useState<'emailInput' | 'signIn' | 'forgotPassword' | 'setPassword'>('emailInput'); // Adicionado 'setPassword'
  const [emailForSignIn, setEmailForSignIn] = useState('');
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [showUnauthorizedModal, setShowUnauthorizedModal] = useState(false);

  const passwordForm = useForm<NewPasswordFormValues>({ // Inicializado useForm para a nova senha
    resolver: zodResolver(newPasswordSchema),
    defaultValues: {
      newPassword: '',
      confirmNewPassword: '',
    },
  });
  const [isSettingPassword, setIsSettingPassword] = useState(false); // Estado para o formulário de senha

  useEffect(() => {
    if (session?.user) {
      // Se o usuário já está logado, não precisamos fazer nada aqui, o AuthProtectedRoute cuidará do redirecionamento.
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

  if (session) {
    // Se a sessão existe, o AuthProtectedRoute vai lidar com o redirecionamento para /today ou /onboarding-quiz
    return <Navigate to="/today" replace />;
  }

  const handleContactSupport = () => {
    setShowUnauthorizedModal(false);
    navigate('/help-and-support');
  };

  const handleContinueWithEmail = async () => {
    if (!emailForSignIn) {
      showError("Por favor, digite seu email.");
      return;
    }

    setIsCheckingEmail(true);
    try {
      const normalizedEmail = emailForSignIn.trim().toLowerCase();
      console.log('Login: Checking email (normalized):', normalizedEmail);

      const { data, error } = await supabase.functions.invoke('check-email-authorization', {
        body: { email: normalizedEmail },
      });

      if (error) {
        console.error('Login: Erro ao chamar Edge Function check-email-authorization:', error);
        showError('Ocorreu um erro ao verificar seu email. Tente novamente.');
        return;
      }

      if (!data || !data.isAuthorized) {
        console.log('Login: Email not authorized by Edge Function:', normalizedEmail);
        setShowUnauthorizedModal(true);
        return;
      }

      console.log('Login: Email authorized by Edge Function:', normalizedEmail);
      
      if (!data.passwordChanged) {
        console.log('Login: Password not changed, showing set password form.');
        setCurrentScreen('setPassword'); // Mudar para a tela de definir senha
      } else {
        console.log('Login: Password already changed, proceeding to sign in.');
        setCurrentScreen('signIn');
      }
    } catch (err) {
      console.error('Login: Erro inesperado ao verificar email:', err);
      showError('Ocorreu um erro inesperado.');
    } finally {
      setIsCheckingEmail(false);
    }
  };

  const handleSetNewPassword = async (values: NewPasswordFormValues) => {
    setIsSettingPassword(true);
    passwordForm.clearErrors();

    try {
      // 1. Fazer login com uma senha temporária (ou sem senha, se o usuário ainda não tiver uma)
      // Para usuários que nunca definiram senha, o Supabase Auth pode não permitir signInWithPassword.
      // A melhor abordagem é usar `resetPasswordForEmail` e direcionar para o link,
      // ou, se o usuário já existe mas com password_changed=false, significa que ele já tem uma senha inicial
      // (provavelmente definida pelo admin ou um valor padrão).
      // Para simplificar, vamos assumir que o usuário já está "logado" implicitamente
      // após a verificação do email e pode atualizar a senha.
      // No entanto, para atualizar a senha, o usuário precisa estar autenticado.
      // Se o usuário não tem uma sessão ativa, ele não pode chamar `updateUser`.
      // O fluxo correto seria:
      // 1. Verificar email (feito)
      // 2. Se password_changed=false, enviar um email de redefinição de senha para o usuário.
      // 3. O usuário clica no link do email e define a senha.
      // 4. Após definir a senha, ele é redirecionado para o app e a flag `password_changed` é atualizada.

      // ALTERNATIVA (mais simples para o contexto atual, mas menos segura se o usuário não estiver logado):
      // Se o usuário chegou aqui, ele digitou um email autorizado.
      // Podemos tentar fazer um "login" com uma senha temporária ou um token,
      // ou, mais robusto, enviar um email de redefinição de senha.

      // Dado que o `AuthProtectedRoute` espera `session` e `passwordChanged`,
      // e o usuário não tem uma sessão ativa neste ponto, a `updateUser` não funcionará.
      // A solução mais segura e alinhada com o Supabase é forçar uma redefinição de senha.

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(emailForSignIn, {
        redirectTo: `${window.location.origin}/login?password_reset=true`, // Redireciona de volta para o login com um flag
      });

      if (resetError) {
        throw resetError;
      }

      showSuccess("Um email com instruções para definir sua senha foi enviado para " + emailForSignIn + ". Por favor, verifique sua caixa de entrada.");
      setCurrentScreen('emailInput'); // Volta para a tela inicial de email
      setEmailForSignIn(''); // Limpa o email
      passwordForm.reset(); // Limpa o formulário de senha
    } catch (error: any) {
      showError("Erro ao enviar email de redefinição de senha: " + error.message);
      console.error("Erro ao enviar email de redefinição:", error);
    } finally {
      setIsSettingPassword(false);
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
        showLinks={false}
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

      {currentScreen === 'setPassword' && (
        <Card className="w-full max-w-md p-6 space-y-6 animate-fade-in">
          <CardHeader className="p-0 pb-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute top-4 left-4 text-muted-foreground hover:text-primary"
              onClick={() => setCurrentScreen('emailInput')}
              disabled={isSettingPassword}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Lock className="h-16 w-16 text-primary mx-auto mb-4" />
            <CardTitle className="text-2xl font-bold text-primary">Defina Sua Nova Senha</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <p className="text-muted-foreground mb-4">
              Para sua segurança, por favor, defina uma nova senha para sua conta.
              Um email será enviado para você com as instruções.
            </p>
            <Form {...passwordForm}>
              <form onSubmit={passwordForm.handleSubmit(handleSetNewPassword)} className="space-y-4">
                <FormField
                  control={passwordForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nova Senha</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Sua nova senha" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="confirmNewPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmar Nova Senha</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Confirme sua nova senha" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  disabled={isSettingPassword || !passwordForm.formState.isValid} 
                  className="w-full py-6 text-lg"
                >
                  {isSettingPassword ? <Loader2 className="h-6 w-6 animate-spin mr-2" /> : null}
                  Enviar Link para Definir Senha
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {currentScreen === 'signIn' && renderAuthComponent('sign_in', emailForSignIn)}
      {currentScreen === 'forgotPassword' && renderAuthComponent('forgotten_password', emailForSignIn)}

      <UnauthorizedEmailModal
        isOpen={showUnauthorizedModal}
        onClose={() => {
          setShowUnauthorizedModal(false);
          setEmailForSignIn('');
        }}
        onContactSupport={handleContactSupport}
      />
    </div>
  );
};

export default Login;