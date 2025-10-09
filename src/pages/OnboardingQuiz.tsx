"use client";

import { Button } from "@/components/ui/button";
import { useNavigate, Navigate } from "react-router-dom"; // Importar Navigate
import { BrainCircuit, ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { showError, showSuccess } from "@/utils/toast";
import { useState, useEffect } from "react";
import { OnboardingQuestions } from "@/components/OnboardingQuestions";
import { PersonalizingExperienceLoading } from "@/components/PersonalizingExperienceLoading";

const OnboardingQuiz = () => {
  const navigate = useNavigate();
  const { session, refetchProfile, onboardingCompleted, loading: sessionLoading } = useSession(); // Adicionado sessionLoading
  const [isCompleting, setIsCompleting] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<'quizIntro' | 'questions' | 'personalizingLoading'>('quizIntro');

  // Se a sessão está carregando, mostra um loader específico para o quiz.
  if (sessionLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-secondary/40 p-4">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando quiz...</p>
        </div>
      </div>
    );
  }

  // Se o onboarding já estiver completo (conforme o SessionContext), redireciona imediatamente.
  // Isso lida com casos em que o usuário, por algum motivo, acessa /onboarding-quiz mas já o concluiu.
  if (onboardingCompleted) {
    return <Navigate to="/today" replace />;
  }

  const handleCompleteOnboarding = async (answers: Record<string, string | string[] | number>) => {
    if (!session?.user) {
      showError("Você precisa estar logado para completar o onboarding.");
      return;
    }
    setIsCompleting(true);
    setCurrentScreen('personalizingLoading'); // Mover para a nova tela de carregamento

    try {
      const { q7: interests, ...otherResponses } = answers;

      const updatePayload: { 
        onboarding_completed: boolean; 
        preferences?: string; 
        quiz_responses?: string; 
      } = {
        onboarding_completed: true,
      };

      if (interests) {
        updatePayload.preferences = JSON.stringify(interests);
      }
      
      if (Object.keys(otherResponses).length > 0) {
        updatePayload.quiz_responses = JSON.stringify(otherResponses);
      }

      const { error } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', session.user.id);

      if (error) {
        console.error("Erro ao marcar onboarding como completo:", error);
        showError("Não foi possível finalizar o onboarding. Tente novamente.");
        setCurrentScreen('questions');
      } else {
        showSuccess("Onboarding concluído! Bem-vindo(a)!");
        await refetchProfile(); // Crucial: Atualiza o contexto da sessão com o novo status
        // A navegação final será feita por PersonalizingExperienceLoading após sua animação.
      }
    } catch (err) {
      console.error("Erro inesperado ao completar onboarding:", err);
      showError("Ocorreu um erro inesperado.");
      setCurrentScreen('questions');
    } finally {
      setIsCompleting(false);
    }
  };

  const handlePersonalizingLoadingComplete = () => {
    // Esta navegação só ocorrerá DEPOIS que a animação de PersonalizingExperienceLoading terminar.
    // A essa altura, refetchProfile já deve ter atualizado o contexto, e AuthProtectedRoute
    // permitirá a navegação para /today.
    navigate('/today', { replace: true }); 
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-4 text-center">
      {currentScreen === 'quizIntro' && (
        <>
          <BrainCircuit className="h-24 w-24 text-primary" />
          <h1 className="text-3xl font-bold text-primary">Bem-vindo ao Quiz!</h1>
          <p className="text-lg text-muted-foreground max-w-md">
            Responda algumas perguntas para personalizarmos sua jornada de fé.
          </p>
          <Button onClick={() => setCurrentScreen('questions')} size="lg" disabled={isCompleting}>
            {isCompleting ? <Loader2 className="h-6 w-6 animate-spin" /> : "Começar Quiz"}
            {!isCompleting && <ArrowRight className="h-5 w-5 ml-2" />}
          </Button>
        </>
      )}
      {currentScreen === 'questions' && (
        <OnboardingQuestions onQuizComplete={handleCompleteOnboarding} isCompleting={isCompleting} />
      )}
      {currentScreen === 'personalizingLoading' && (
        <PersonalizingExperienceLoading onComplete={handlePersonalizingLoadingComplete} />
      )}
    </div>
  );
};

export default OnboardingQuiz;