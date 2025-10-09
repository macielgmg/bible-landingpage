import React, { useEffect, useState, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Circle, PlayCircle, Loader2, ChevronLeft, ChevronRight, Highlighter } from 'lucide-react';
import { useSession } from '@/contexts/SessionContext';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from '@/lib/utils';
import { showError } from '@/utils/toast';

interface ChapterFromDB {
  id: string;
  study_id: string;
  chapter_number: number;
  page_number: number;
  title: string;
}

interface Chapter extends ChapterFromDB {
  completed: boolean;
}

interface StudyFromDB {
  id: string;
  title: string;
  description: string;
  cover_image_url: string;
  chapter_title_display_format: 'title_only' | 'chapter_number_only' | 'chapter_and_page_number' | 'part_title_only';
}

const CHAPTERS_PER_PAGE = 10;

const StudyDetail = () => {
  const { studyId } = useParams<{ studyId: string }>();
  const { session } = useSession(); 
  const navigate = useNavigate();
  const [study, setStudy] = useState<StudyFromDB | null>(null);
  const [allChapters, setAllChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchStudyData = async () => {
      if (!studyId || !session) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const { data: studyData, error: studyError } = await supabase
          .from('studies')
          .select('*')
          .eq('id', studyId)
          .single();

        if (studyError) throw studyError;
        if (!studyData) {
          console.error('Estudo não encontrado no banco de dados:', studyId);
          setLoading(false);
          return;
        }
        setStudy(studyData);

        const { data: chaptersData, error: chaptersError } = await supabase
          .from('chapters')
          .select('*')
          .eq('study_id', studyId)
          .order('chapter_number', { ascending: true })
          .order('page_number', { ascending: true });

        if (chaptersError) throw chaptersError;
        if (!chaptersData) {
          console.error('Capítulos não encontrados para o estudo:', studyId);
          setAllChapters([]);
          setLoading(false);
          return;
        }

        const chapterIds = chaptersData.map(c => c.id);

        const { data: progressData, error: progressError } = await supabase
          .from('user_progress')
          .select('chapter_id, completed_at')
          .eq('user_id', session.user.id)
          .in('chapter_id', chapterIds);

        if (progressError) {
          console.error('Erro ao buscar progresso dos capítulos:', progressError);
          setAllChapters(chaptersData.map(c => ({ ...c, completed: false })));
          setLoading(false);
          return;
        }

        const completedChapterIds = new Set(
          progressData
            .filter(p => p.completed_at !== null)
            .map(p => p.chapter_id)
        );

        const chaptersWithProgress = chaptersData.map(chapter => ({
          ...chapter,
          completed: completedChapterIds.has(chapter.id),
        }));

        setAllChapters(chaptersWithProgress);

      } catch (error: any) {
        console.error('Error fetching study data:', error);
        setStudy(null);
        setAllChapters([]);
        if (error.code !== 'PGRST116') {
          showError('Erro ao carregar detalhes do estudo: ' + error.message);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchStudyData();
  }, [studyId, session]); 

  const nextChapter = React.useMemo(() => {
    if (allChapters.length === 0) return null;
    const firstUncompleted = allChapters.find(c => !c.completed);
    if (firstUncompleted) {
      return firstUncompleted;
    }
    return allChapters[allChapters.length - 1];
  }, [allChapters]);

  const handleContinue = () => {
    if (nextChapter) {
      navigate(`/study/${studyId}/chapter/${nextChapter.id}`);
    }
  };

  const totalPages = Math.ceil(allChapters.length / CHAPTERS_PER_PAGE);
  const startIndex = (currentPage - 1) * CHAPTERS_PER_PAGE;
  const endIndex = startIndex + CHAPTERS_PER_PAGE;
  const displayedChapters = allChapters.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const renderPaginationItems = () => {
    const items = [];
    const siblingCount = 1;
    const totalPagesToShow = siblingCount * 2 + 1;

    const addPageItem = (page: number, isActive: boolean) => (
      <PaginationItem key={page}>
        <PaginationLink isActive={isActive} onClick={() => handlePageChange(page)}>
          {page}
        </PaginationLink>
      </PaginationItem>
    );

    if (totalPages <= totalPagesToShow + 2) {
      for (let i = 1; i <= totalPages; i++) {
        items.push(addPageItem(i, currentPage === i));
      }
      return items;
    }

    const startPage = Math.max(2, currentPage - siblingCount);
    const endPage = Math.min(totalPages - 1, currentPage + siblingCount);

    const showLeftEllipsis = startPage > 2;
    const showRightEllipsis = endPage < totalPages - 1;

    items.push(addPageItem(1, currentPage === 1));

    if (showLeftEllipsis) {
      items.push(
        <PaginationItem key="left-ellipsis">
          <Select onValueChange={(value) => handlePageChange(parseInt(value))} value={String(currentPage)}>
            <SelectTrigger className="h-9 w-9 p-0 flex items-center justify-center">
              <SelectValue placeholder="..." />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <SelectItem key={page} value={String(page)}>
                  {page}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PaginationItem>
      );
    }

    for (let i = startPage; i <= endPage; i++) {
      items.push(addPageItem(i, currentPage === i));
    }

    if (showRightEllipsis) {
      items.push(
        <PaginationItem key="right-ellipsis">
          <Select onValueChange={(value) => handlePageChange(parseInt(value))} value={String(currentPage)}>
            <SelectTrigger className="h-9 w-9 p-0 flex items-center justify-center">
              <SelectValue placeholder="..." />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <SelectItem key={page} value={String(page)}>
                  {page}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PaginationItem>
      );
    }

    if (totalPages > 1 && currentPage !== totalPages && !items.some(item => item.key === totalPages)) {
      items.push(addPageItem(totalPages, currentPage === totalPages));
    }
    
    return items;
  };

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-160px)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!study) {
    return <div className="text-center">Estudo não encontrado.</div>;
  }

  const completedChapters = allChapters.filter(c => c.completed).length;
  const totalChapters = allChapters.length;
  const progressPercentage = totalChapters > 0 ? (completedChapters / totalChapters) * 100 : 0;

  const getChapterTitleDisplay = (chapter: ChapterFromDB) => {
    switch (study?.chapter_title_display_format) {
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
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl text-primary">{study.title}</CardTitle>
          <CardDescription>{study.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="font-semibold">Progresso</h3>
                <span className="text-sm text-muted-foreground">{completedChapters} de {totalChapters} concluídos</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2.5">
              <div className="bg-primary h-2.5 rounded-full" style={{ width: `${progressPercentage}%` }}></div>
            </div>
            {nextChapter && (
              <Button onClick={handleContinue} className="w-full">
                <PlayCircle className="mr-2 h-4 w-4" />
                {completedChapters === totalChapters ? 'Revisar último capítulo' : 'Continuar de onde parou'}
              </Button>
            )}
          </div>

          <h3 className="text-xl font-bold mb-4 text-primary">Capítulos</h3>
          <div className="space-y-3">
            {displayedChapters.map((chapter) => (
              <div
                key={chapter.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-secondary/50 transition-colors"
              >
                <Link
                  to={`/study/${studyId}/chapter/${chapter.id}`}
                  className="flex items-center gap-4 flex-grow"
                >
                  {chapter.completed ? <CheckCircle className="h-5 w-5 text-green-500" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                  <span className="font-medium">
                    {getChapterTitleDisplay(chapter)}
                  </span>
                </Link>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => navigate(`/study/${studyId}/chapter/${chapter.id}?highlight=true`)}
                  className="ml-2 text-primary hover:bg-primary/10"
                >
                  <Highlighter className="h-5 w-5" />
                  <span className="sr-only">Marcar texto</span>
                </Button>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <Pagination className="mt-8">
              <PaginationContent>
                <PaginationItem>
                  <PaginationLink
                    onClick={() => handlePageChange(currentPage - 1)}
                    isActive={false}
                    className={cn("h-9 w-9 p-0", currentPage === 1 && "pointer-events-none opacity-50")}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="sr-only">Página anterior</span>
                  </PaginationLink>
                </PaginationItem>
                {renderPaginationItems()}
                <PaginationItem>
                  <Select onValueChange={(value) => handlePageChange(parseInt(value))} value={String(currentPage)}>
                    <SelectTrigger className="h-9 w-9 p-0 flex items-center justify-center">
                      <SelectValue placeholder="..." />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <SelectItem key={page} value={String(page)}>
                          {page}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </PaginationItem>
                <PaginationItem>
                  <PaginationLink
                    onClick={() => handlePageChange(currentPage + 1)}
                    isActive={false}
                    className={cn("h-9 w-9 p-0", currentPage === totalPages && "pointer-events-none opacity-50")}
                  >
                    <ChevronRight className="h-4 w-4" />
                    <span className="sr-only">Próxima página</span>
                  </PaginationLink>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StudyDetail;