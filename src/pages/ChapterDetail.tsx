import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useSession } from '@/contexts/SessionContext';
import { ArrowLeft, ArrowRight, BookOpen, Loader2, Highlighter as HighlighterIcon, Trash2, CheckCircle, XCircle, Eraser } from 'lucide-react';
import { showError, showAchievementToast, showSuccess } from '@/utils/toast';
import { checkAndAwardAchievements } from '@/utils/achievements';
import { useQueryClient } from '@tanstack/react-query';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HighlightableText } from '@/components/HighlightableText';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { logUserActivity } from '@/utils/logging';

interface ChapterDetailData {
  id: string;
  title: string;
  chapter_number: number;
  page_number: number;
  study_id: string;
  study_title: string;
  bible_text: string;
  explanation: string;
  application: string;
  study_chapter_title_display_format: 'title_only' | 'chapter_number_only' | 'chapter_and_page_number' | 'part_title_only';
}

interface ChapterFromDB {
  id: string;
  study_id: string;
  chapter_number: number;
  page_number: number;
  title: string;
}

const ChapterDetail = () => {
  const { studyId, chapterId } = useParams<{ studyId: string; chapterId: string }>();
  const { session } = useSession(); 
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [chapterData, setChapterData] = useState<ChapterDetailData | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userNotes, setUserNotes] = useState<string>('');
  const [initialNotes, setInitialNotes] = useState<string>('');
  const [allChaptersInStudy, setAllChaptersInStudy] = useState<ChapterFromDB[]>([]);
  const [currentChapterIndex, setCurrentChapterIndex] = useState<number>(-1);
  const [completedChaptersCount, setCompletedChaptersCount] = useState(0);
  const [totalChaptersCount, setTotalChaptersCount] = useState(0);
  const [isHighlightingMode, setIsHighlightingMode] = useState(false);
  const [isErasingMode, setIsErasingMode] = useState(false);
  const [showConfirmDeleteAllHighlights, setShowConfirmDeleteAllHighlights] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const highlightParam = params.get('highlight');
    if (highlightParam === 'true') {
      setIsHighlightingMode(true);
      setIsErasingMode(false);
    } else {
      setIsHighlightingMode(false);
      setIsErasingMode(false);
    }
  }, [location.search, navigate, location.pathname]);

  const saveChapterProgress = useCallback(async (
    currentChapterId: string,
    currentStudyId: string,
    userId: string,
    notes: string,
    markAsCompleted: boolean
  ) => {
    const { data: existingProgress, error: fetchError } = await supabase
      .from('user_progress')
      .select('id, completed_at')
      .eq('user_id', userId)
      .eq('chapter_id', currentChapterId)
      .maybeSingle();

    if (fetchError) {
      showError('Erro ao verificar progresso: ' + fetchError.message);
      console.error('Error fetching existing progress:', fetchError);
      return false;
    }

    const updateData: { notes: string; completed_at?: string | null; study_id?: string } = { notes: notes };
    
    if (markAsCompleted) {
      updateData.completed_at = new Date().toISOString();
    } else {
      updateData.completed_at = existingProgress?.completed_at || null;
    }
    updateData.study_id = currentStudyId;

    if (existingProgress) {
      const { error: updateError } = await supabase
        .from('user_progress')
        .update(updateData)
        .eq('id', existingProgress.id);

      if (updateError) {
        showError('Erro ao atualizar progresso: ' + updateError.message);
        console.error('Error updating progress:', updateError);
        return false;
      }
    } else {
      const { error: insertError } = await supabase
        .from('user_progress')
        .insert({ 
          user_id: userId, 
          chapter_id: currentChapterId, 
          study_id: currentStudyId,
          notes: notes, 
          completed_at: markAsCompleted ? new Date().toISOString() : null 
        });

      if (insertError) {
        showError('Erro ao salvar progresso: ' + insertError.message);
        console.error('Error inserting progress:', insertError);
        return false;
      }
    }
    return true;
  }, []);

  const fetchChapterAndStudyData = useCallback(async () => {
    if (!chapterId || !studyId || !session) {
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      // 1. Fetch study details from DB
      const { data: studyData, error: studyError } = await supabase
        .from('studies')
        .select('id, title, chapter_title_display_format')
        .eq('id', studyId)
        .single();

      if (studyError) throw studyError;
      if (!studyData) {
        console.error('Estudo não encontrado no banco de dados:', studyId);
        setLoading(false);
        return;
      }

      // 2. Fetch current chapter details from DB, including bible_text, explanation, and application
      const { data: chapterDB, error: chapterError } = await supabase
        .from('chapters')
        .select('*, bible_text, explanation, application, page_number')
        .eq('id', chapterId)
        .eq('study_id', studyId)
        .single();

      if (chapterError) throw chapterError;
      if (!chapterDB) {
        console.error('Capítulo não encontrado no banco de dados:', chapterId);
        setLoading(false);
        return;
      }

      // 3. Fetch all chapters for the study to determine navigation and total count
      const { data: allChaptersData, error: allChaptersError } = await supabase
        .from('chapters')
        .select('id, study_id, chapter_number, page_number, title')
        .eq('study_id', studyId)
        .order('chapter_number', { ascending: true })
        .order('page_number', { ascending: true });

      if (allChaptersError) throw allChaptersError;
      if (!allChaptersData) {
        console.error('Não foi possível carregar todos os capítulos para o estudo:', studyId);
        setAllChaptersInStudy([]);
        setTotalChaptersCount(0);
      } else {
        setAllChaptersInStudy(allChaptersData);
        setTotalChaptersCount(allChaptersData.length);
        const chapterIndex = allChaptersData.findIndex(c => c.id === chapterId);
        setCurrentChapterIndex(chapterIndex);
      }

      // Set chapter data directly from DB
      setChapterData({
        id: chapterDB.id,
        title: chapterDB.title,
        chapter_number: chapterDB.chapter_number,
        page_number: chapterDB.page_number,
        study_id: studyData.id,
        study_title: studyData.title,
        bible_text: chapterDB.bible_text || 'Conteúdo bíblico não disponível.',
        explanation: chapterDB.explanation || 'Explicação não disponível.',
        application: chapterDB.application || '', // Definir como string vazia se não disponível
        study_chapter_title_display_format: studyData.chapter_title_display_format,
      });

      // 5. Fetch user progress and notes for current chapter
      const { data: progressData, error: progressError } = await supabase
        .from('user_progress')
        .select('id, notes, completed_at')
        .eq('user_id', session.user.id)
        .eq('chapter_id', chapterId)
        .maybeSingle();
      
      if (!progressError && progressData) {
        setIsCompleted(!!progressData.completed_at);
        setUserNotes(progressData.notes || '');
        setInitialNotes(progressData.notes || '');
      } else {
        setIsCompleted(false);
        setUserNotes('');
        setInitialNotes('');
      }

      // 6. Fetch overall study progress for progress bar
      const { data: allProgress, error: allProgressError } = await supabase
        .from('user_progress')
        .select('chapter_id, completed_at')
        .eq('user_id', session.user.id)
        .eq('study_id', studyId);

      if (!allProgressError && allProgress) {
        const completed = allProgress.filter(p => p.completed_at !== null).length;
        setCompletedChaptersCount(completed);
      } else {
        setCompletedChaptersCount(0);
      }

    } catch (error: any) {
      console.error('Error in fetchChapterAndStudyData:', error);
      setChapterData(null);
      if (error.code !== 'PGRST116') {
        showError('Erro ao carregar o capítulo: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  }, [chapterId, studyId, session]);

  useEffect(() => {
    fetchChapterAndStudyData();
  }, [fetchChapterAndStudyData]);

  const handleAdvance = async () => {
    if (!session || !chapterData) return;

    const success = await saveChapterProgress(chapterData.id, chapterData.study_id, session.user.id, userNotes, true);

    if (success) {
      setIsCompleted(true);
      
      logUserActivity(session.user.id, 'chapter_completed', `Concluiu o capítulo ${chapterData.chapter_number}.${chapterData.page_number} do estudo "${chapterData.study_title}".`);

      const { newAchievements } = await checkAndAwardAchievements(session.user.id);
      newAchievements.forEach((ach, index) => {
        setTimeout(() => showAchievementToast(ach), index * 700);
      });

      queryClient.invalidateQueries({ queryKey: ['profileData', session.user.id] });
      queryClient.invalidateQueries({ queryKey: ['studyProgress', session.user.id, studyId] });

      if (nextChapter) {
        navigate(`/study/${studyId}/chapter/${nextChapter.id}`);
        showSuccess('Capítulo concluído!');
      } else {
        navigate(`/study/${studyId}`);
        showSuccess('Estudo finalizado!');
      }
    }
  };

  const handleSaveNotes = async () => {
    if (!session || !chapterData) return;

    const success = await saveChapterProgress(chapterData.id, chapterData.study_id, session.user.id, userNotes, isCompleted);
    if (success) {
      setInitialNotes(userNotes);
      showSuccess('Anotações salvas com sucesso!');
      logUserActivity(session.user.id, 'chapter_notes_saved', `Salvou anotações para o capítulo ${chapterData?.chapter_number}.${chapterData?.page_number} do estudo "${chapterData?.study_title}".`);
    }
  };

  const handleCancelNotes = () => {
    setUserNotes(initialNotes); // Restaura as anotações para o estado inicial
    showSuccess('Anotações canceladas.');
  };

  const handleRemoveAllHighlights = async () => {
    if (!session?.user || !chapterId) return;

    try {
      const { error } = await supabase
        .from('user_highlights')
        .delete()
        .eq('user_id', session.user.id)
        .eq('chapter_id', chapterId);

      if (error) throw error;

      showSuccess('Todas as marcações foram removidas!');
      logUserActivity(session.user.id, 'highlights_removed', `Removeu todas as marcações do capítulo ${chapterData?.chapter_number}.${chapterData?.page_number} do estudo "${chapterData?.study_title}".`);
      queryClient.invalidateQueries({ queryKey: ['userHighlights', session.user.id, chapterId] });
      setShowConfirmDeleteAllHighlights(false);
    } catch (error: any) {
      console.error('Error deleting all highlights:', error);
      showError('Erro ao remover todas as marcações: ' + error.message);
    }
  };

  const prevChapter = currentChapterIndex > 0 ? allChaptersInStudy[currentChapterIndex - 1] : null;
  const nextChapter = currentChapterIndex < allChaptersInStudy.length - 1 ? allChaptersInStudy[currentChapterIndex + 1] : null;
  const progressPercentage = totalChaptersCount > 0 ? (completedChaptersCount / totalChaptersCount) * 100 : 0;

  const isAnyHighlightingModeActive = isHighlightingMode || isErasingMode;

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-160px)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!chapterData) {
    return <div className="text-center p-8">Capítulo não encontrado.</div>;
  }

  const getChapterTitleDisplay = (chapter: ChapterDetailData) => {
    switch (chapter.study_chapter_title_display_format) {
      case 'title_only':
        return chapter.title;
      case 'chapter_number_only':
        return `Capítulo ${chapter.chapter_number}: ${chapter.title}`;
      case 'chapter_and_page_number':
        // Lógica atualizada: sempre exibe Capítulo X.Y: Título
        return `Capítulo ${chapter.chapter_number}.${chapter.page_number}: ${chapter.title}`;
      case 'part_title_only':
        return `Parte ${chapter.chapter_number}: ${chapter.title}`; // NOVO: Formato para 'part_title_only'
      default:
        return chapter.title;
    }
  };

  return (
    <div className="container mx-auto max-w-3xl">
      <div className="fixed top-0 left-0 right-0 z-10 bg-background p-4 border-b border-border flex justify-around items-center max-w-3xl mx-auto gap-2">
        {/* Botão Voltar (para capítulo anterior) */}
        <Button 
          variant="ghost" 
          onClick={() => prevChapter ? navigate(`/study/${studyId}/chapter/${prevChapter.id}`) : null} 
          disabled={!prevChapter || isAnyHighlightingModeActive}
          className="flex-1"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        
        {/* Botão Voltar ao Estudo (para a página de detalhes do estudo) */}
        <Button variant="ghost" onClick={() => navigate(`/study/${studyId}`)} className="flex-1">
            <BookOpen className="mr-2 h-4 w-4" />
            Estudos
        </Button>
        
        {/* Botão Avançar (para próximo capítulo ou finalizar) */}
        <Button 
          onClick={handleAdvance} 
          disabled={!session || isAnyHighlightingModeActive}
          className="flex-1"
        >
          {nextChapter ? 'Avançar' : 'Finalizar Estudo'}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
      <Card className="mt-20">
        <CardHeader>
          <CardTitle className="text-3xl text-primary">
            {getChapterTitleDisplay(chapterData)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="prose max-w-none">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-primary/90">Texto Bíblico</h3>
              
              {/* Dropdown Menu para opções de marcação */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className={isAnyHighlightingModeActive ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}
                  >
                    <HighlighterIcon className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {isAnyHighlightingModeActive ? (
                    <DropdownMenuItem onClick={() => {
                      setIsHighlightingMode(false);
                      setIsErasingMode(false);
                    }}>
                      <XCircle className="h-4 w-4 mr-2 text-destructive" /> Sair do Modo Marcação
                    </DropdownMenuItem>
                  ) : (
                    <>
                      <DropdownMenuItem onClick={() => {
                        setIsHighlightingMode(true);
                        setIsErasingMode(false);
                      }}>
                        <HighlighterIcon className="h-4 w-4 mr-2 text-primary" /> Começar a Marcar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        setIsErasingMode(true);
                        setIsHighlightingMode(false);
                      }}>
                        <Eraser className="h-4 w-4 mr-2 text-primary" /> Apagar Marcações Individuais
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => {
                      setShowConfirmDeleteAllHighlights(true);
                    }}
                    className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Remover Todas as Marcações
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <HighlightableText 
              text={chapterData.bible_text} 
              chapterId={chapterData.id} 
              isHighlightingMode={isHighlightingMode} 
              isErasingMode={isErasingMode}
            />
            
            <h3 className="font-bold text-lg text-primary/90 mt-6">Explicação</h3>
            <p>{chapterData.explanation}</p>

            <div className="mb-6 space-y-2 pt-4 border-t border-muted-foreground/20 mt-6">
                <div className="flex justify-between items-center">
                    <h4 className="font-semibold text-primary/80">Progresso</h4>
                    <span className="text-sm text-muted-foreground">{completedChaptersCount} de {totalChaptersCount} concluídos</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2.5">
                    <div className="bg-primary h-2.5 rounded-full" style={{ width: `${progressPercentage}%` }}></div>
                </div>
            </div>

            {chapterData.application && ( // Renderização condicional
              <>
                <h3 className="font-bold text-lg text-primary/90 mt-6">Aplicação Prática</h3>
                <p>{chapterData.application}</p>
              </>
            )}
          </div>

          {/* Seção de Anotações Colapsável */}
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="my-notes" className="border-none">
              <AccordionTrigger className="flex items-center justify-between rounded-lg p-3 text-base font-bold text-primary hover:no-underline bg-secondary/50">
                <div className="flex items-center gap-2">
                  Minhas Anotações
                </div>
              </AccordionTrigger>
              <AccordionContent className="p-4 pt-0">
                <div className="space-y-4">
                  <Textarea
                    placeholder="Escreva suas anotações aqui..."
                    value={userNotes}
                    onChange={(e) => setUserNotes(e.target.value)}
                    className="min-h-[120px]"
                    disabled={isAnyHighlightingModeActive}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button 
                      variant="outline" 
                      onClick={handleCancelNotes} 
                      disabled={userNotes === initialNotes || isAnyHighlightingModeActive}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      onClick={handleSaveNotes} 
                      disabled={userNotes === initialNotes || isAnyHighlightingModeActive}
                    >
                      Salvar Anotações
                    </Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* AlertDialog para confirmar a remoção de todas as marcações */}
      <AlertDialog open={showConfirmDeleteAllHighlights} onOpenChange={setShowConfirmDeleteAllHighlights}>
        <AlertDialogContent>
          <AlertDialogHeader className="flex flex-col items-center text-center">
            <Trash2 className="h-16 w-16 text-destructive mb-4" />
            <AlertDialogTitle className="text-2xl font-bold text-primary">Remover Todas as Marcações?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Tem certeza que deseja remover todas as suas marcações neste capítulo? Esta ação não pode ser desfeita.
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
                onClick={handleRemoveAllHighlights}
              >
                Remover Tudo
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ChapterDetail;