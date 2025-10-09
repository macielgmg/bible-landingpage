import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { useSession } from "@/contexts/SessionContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import { 
  User, 
  ChevronRight, 
  MessageSquare, 
  HelpCircle, 
  Flame,
  BookOpen,
  Sparkles,
  Target,
  Loader2,
  Award,
  GraduationCap,
  Crown,
  TrendingUp,
  Icon as LucideIcon,
  Settings, // Para Configurações gerais
  UserCog, // Para Dados Básicos
  HeartHandshake, // Para Interesses e Preferências
  LogOut, // Para Sair
  LayoutDashboard, // NOVO: Para o painel de administração
  Lock, // NOVO: Para Segurança da Conta
  // CreditCard, // Removido: Para Gerenciar Assinatura
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
// Removido: import { Badge } from "@/components/ui/badge";
import { checkAndAwardAchievements } from '@/utils/achievements'; // Importar a função de verificação de conquistas
import { showAchievementToast } from '@/utils/toast'; // Importar o toast de conquista
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"; // Importar AlertDialog
import { logUserActivity } from '@/utils/logging'; // Importar logUserActivity

// --- Tipos e Componentes (sem alteração) ---

const iconComponents: { [key: string]: typeof LucideIcon } = {
  Sparkles, BookOpen, GraduationCap, Crown, Flame, TrendingUp, Award, Target,
};

const StatCard = ({ title, value }: { title: string, value: string | number }) => (
  <Card className="flex-1 text-center bg-secondary/50 border-none shadow-sm">
    <CardContent className="p-4 flex flex-col items-center justify-center">
      <p className="text-2xl font-bold text-primary">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{title}</p>
    </CardContent>
  </Card>
);

const AchievementCard = ({ title, description, iconName, isUnlocked }: { title: string, description: string, iconName: string, isUnlocked: boolean }) => {
  const Icon = iconComponents[iconName] || Target;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Card className={cn("flex flex-col items-center justify-center p-4 bg-card text-center h-full transition-all", !isUnlocked && "grayscale opacity-50")}>
            <div className="p-3 rounded-full bg-primary/10 mb-2"><Icon className="h-6 w-6 text-primary" /></div>
            <p className="text-xs font-semibold text-primary/90 leading-tight">{title}</p>
          </Card>
        </TooltipTrigger>
        <TooltipContent><p className="font-bold">{title}</p><p>{description}</p></TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

interface Achievement {
  id: string; name: string; description: string; icon_name: string;
}

// --- Funções de busca de dados ---

const fetchProfileData = async (userId: string) => {
  const [profilePromise, progressPromise, allAchievementsPromise, unlockedAchievementsPromise] = [
    supabase.from('profiles').select('streak_count').eq('id', userId).single(),
    supabase.from('user_progress').select('*', { count: 'exact', head: true }).eq('user_id', userId).not('completed_at', 'is', null),
    supabase.from('achievements').select('*'),
    supabase.from('user_achievements').select('achievement_id').eq('user_id', userId)
  ];

  const [
    { data: profileData, error: profileError },
    { count, error: progressError },
    { data: allAchievementsData, error: allAchievementsError },
    { data: unlockedAchievementsData, error: unlockedAchievementsError }
  ] = await Promise.all([profilePromise, progressPromise, allAchievementsPromise, unlockedAchievementsPromise]);

  if (profileError) throw profileError;
  if (progressError) throw progressError;
  if (allAchievementsError) throw allAchievementsError;
  if (unlockedAchievementsError) throw unlockedAchievementsError;

  const unlockedAchievementIds = new Set(unlockedAchievementsData?.map(a => a.achievement_id) || []);
  const allAchievements: Achievement[] = allAchievementsData || [];

  // Separar conquistas desbloqueadas e não desbloqueadas
  const unlocked = allAchievements.filter(ach => unlockedAchievementIds.has(ach.id));
  const locked = allAchievements.filter(ach => !unlockedAchievementIds.has(ach.id));

  // Combinar, colocando as desbloqueadas primeiro
  const sortedAchievements = [...unlocked, ...locked];

  return {
    stats: {
      streak: profileData?.streak_count || 0,
      chaptersCompleted: count || 0,
    },
    allAchievements: sortedAchievements, // Retorna a lista ordenada
    unlockedAchievementIds: unlockedAchievementIds,
  };
};

// --- Componente Principal ---

const Profile = () => {
  const { session, fullName, avatarUrl, isAdmin } = useSession(); // NOVO: Obter isAdmin
  const navigate = useNavigate();

  const { data, isLoading: loading } = useQuery({
    queryKey: ['profileData', session?.user?.id],
    queryFn: () => fetchProfileData(session!.user!.id),
    enabled: !!session?.user,
  });

  // REATIVADO: Efeito para verificar conquistas ao carregar a página de perfil
  useEffect(() => {
    const checkAchievementsOnLoad = async () => {
      if (session?.user && !loading) {
        const { newAchievements } = await checkAndAwardAchievements(session.user.id); // Corrigido aqui
        newAchievements.forEach((ach, index) => {
          setTimeout(() => showAchievementToast(ach), index * 700);
        });
      }
    };
    checkAchievementsOnLoad();
  }, [session, loading]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  // NOVO: Função para navegar para o painel de administração
  const handleGoToAdminPanel = () => {
    if (session?.user?.id) {
      logUserActivity(session.user.id, 'admin_panel_access', 'Acessou o painel de administração.');
    }
    navigate('/management');
  };

  const getInitials = (name: string | null | undefined, email: string | null | undefined) => {
    if (name) {
      const names = name.split(' ');
      return names.length > 1 ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase() : name.substring(0, 2).toUpperCase();
    }
    return email ? email.substring(0, 2).toUpperCase() : 'U';
  };

  const stats = data?.stats || { streak: 0, chaptersCompleted: 0 };
  const sortedAchievements = data?.allAchievements || []; // Usar a lista já ordenada
  const unlockedAchievementIds = data?.unlockedAchievementIds || new Set();

  return (
    <div className="container mx-auto max-w-2xl pb-8">
      <div className="flex flex-col items-center space-y-2 pt-6 pb-4">
        <Avatar className="h-24 w-24 border-2 border-primary/20">
          <AvatarImage src={avatarUrl || undefined} alt="Foto do perfil" />
          <AvatarFallback className="text-3xl bg-secondary">{getInitials(fullName, session?.user?.email)}</AvatarFallback>
        </Avatar>
        <div className="text-center">
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-2xl font-bold text-primary">{fullName || 'Usuário'}</h1>
            {/* Removido: isPro Badge */}
          </div>
          <p className="text-muted-foreground">{session?.user?.email}</p>
        </div>
      </div>

      <div className="flex gap-3 mb-8">
        {loading ? (
          <div className="w-full flex justify-center items-center h-24"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <>
            <StatCard title="Capítulos Concluídos" value={stats.chaptersCompleted} />
            <StatCard title="Sequência de Dias" value={stats.streak} />
            <StatCard title="Conquistas" value={unlockedAchievementIds.size} />
          </>
        )}
      </div>

      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-primary">Conquistas</h2>
          <Link to="/achievements" className="text-sm font-medium text-primary hover:underline flex items-center gap-1">
            Ver todas <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        {loading ? (
          <div className="w-full flex justify-center items-center h-24"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
            {sortedAchievements.slice(0, 5).map((ach) => (
              <div className="w-24 flex-shrink-0" key={ach.id}>
                <AchievementCard 
                  title={ach.name} 
                  description={ach.description}
                  iconName={ach.icon_name}
                  isUnlocked={unlockedAchievementIds.has(ach.id)} 
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Nova Seção de Configurações */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-primary mb-2">Configurações</h2>

        {/* NOVO: Botão para Painel de Administração (visível apenas para admins) */}
        {isAdmin && (
          <Button 
            variant="default" 
            className="w-full flex items-center justify-between rounded-lg bg-primary p-4 shadow-sm text-primary-foreground hover:bg-primary/90"
            onClick={handleGoToAdminPanel}
          >
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-full bg-primary-foreground/20">
                <LayoutDashboard className="h-5 w-5 text-primary-foreground" />
              </div>
              <p className="font-medium">Painel de Administração</p>
            </div>
            <ChevronRight className="h-5 w-5 text-primary-foreground" />
          </Button>
        )}

        {/* Dados Básicos */}
        <Link 
          to="/personal-data" 
          className="flex items-center justify-between rounded-lg bg-card p-4 shadow-sm transition-colors hover:bg-secondary/50"
        >
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-full bg-primary/10">
              <UserCog className="h-5 w-5 text-primary" />
            </div>
            <p className="font-medium text-foreground">Dados Básicos</p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </Link>

        {/* Segurança da Conta (NOVO) */}
        <Link 
          to="/account-security" 
          className="flex items-center justify-between rounded-lg bg-card p-4 shadow-sm transition-colors hover:bg-secondary/50"
        >
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-full bg-primary/10">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <p className="font-medium text-foreground">Segurança da Conta</p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </Link>

        {/* Interesses e Preferências */}
        <Link 
          to="/preferences" 
          className="flex items-center justify-between rounded-lg bg-card p-4 shadow-sm transition-colors hover:bg-secondary/50"
        >
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-full bg-primary/10">
              <HeartHandshake className="h-5 w-5 text-primary" />
            </div>
            <p className="font-medium text-foreground">Interesses e Preferências</p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </Link>

        {/* Removido: Gerenciar Assinatura */}

        {/* Link para a nova página de Configurações */}
        <Link 
          to="/settings" 
          className="flex items-center justify-between rounded-lg bg-card p-4 shadow-sm transition-colors hover:bg-secondary/50"
        >
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-full bg-primary/10">
              <Settings className="h-5 w-5 text-primary" />
            </div>
            <p className="font-medium text-foreground">Configurações Gerais</p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </Link>

        {/* Ajuda e Suporte */}
        <Link 
          to="/help-and-support" // Link atualizado para a nova página
          className="flex items-center justify-between rounded-lg bg-card p-4 shadow-sm transition-colors hover:bg-secondary/50"
        >
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-full bg-primary/10">
              <HelpCircle className="h-5 w-5 text-primary" />
            </div>
            <p className="font-medium text-foreground">Ajuda e Suporte</p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </Link>

        {/* Botão de Sair com AlertDialog */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button 
              variant="ghost" 
              className="w-full flex items-center justify-between rounded-lg bg-card p-4 shadow-sm text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-full bg-destructive/10">
                  <LogOut className="h-5 w-5" />
                </div>
                <p className="font-medium">Sair</p>
              </div>
              <ChevronRight className="h-5 w-5 text-destructive" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader className="flex flex-col items-center text-center">
              <LogOut className="h-16 w-16 text-destructive mb-4" />
              <AlertDialogTitle className="text-2xl font-bold text-primary">Tem certeza que deseja sair?</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                Você será desconectado da sua conta. Você pode fazer login novamente a qualquer momento.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-center gap-3">
              <AlertDialogCancel asChild>
                <Button variant="outline" className="w-full sm:w-auto">Cancelar</Button>
              </AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button 
                  variant="destructive" 
                  className="w-full sm:w-auto"
                  onClick={handleLogout}
                >
                  Sair
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default Profile;