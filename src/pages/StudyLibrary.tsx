import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/contexts/SessionContext";
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Search, BookOpen, ListFilter } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { showError } from '@/utils/toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isAfter, subDays, parseISO } from 'date-fns'; // Importar funções de data

interface StudyFromDB {
  id: string;
  title: string;
  description: string;
  cover_image_url: string;
  is_visible: boolean;
  created_at: string; // Adicionado created_at para ordenação por data
}

interface ChapterFromDB {
  id: string;
  study_id: string;
  chapter_number: number;
  title: string;
}

interface StudyWithProgress extends StudyFromDB {
  imageUrl: string;
  completedChapters: number;
  totalChapters: number;
  progressPercentage: number;
  isAcquired: boolean;
  isSpecialVisible?: boolean;
  isNew?: boolean; // NOVO: Propriedade para indicar se o estudo é novo
}

const StudyLibrary = () => {
  const { session, loading: sessionLoading, isGabrielSpecialUser } = useSession(); 
  const navigate = useNavigate();
  const [studiesWithProgress, setStudiesWithProgress] = useState<StudyWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name-asc' | 'name-desc' | 'progress-asc' | 'progress-desc' | 'created-at-desc' | 'created-at-asc'>('name-asc'); // NOVO: Estado para a ordenação

  useEffect(() => {
    const fetchStudiesAndProgress = async () => {
      if (sessionLoading) return;

      setLoading(true);
      const userId = session?.user?.id;

      if (!userId) {
        setStudiesWithProgress([]);
        setLoading(false);
        return;
      }

      try {
        // 1. Fetch all studies from the database
        let studiesQuery = supabase
          .from('studies')
          .select('*')
          .order('created_at', { ascending: false });

        // Se não for o usuário especial, filtra por is_visible = true
        if (!isGabrielSpecialUser) {
          studiesQuery = studiesQuery.eq('is_visible', true);
        }

        const { data: studiesData, error: studiesError } = await studiesQuery;

        if (studiesError) throw studiesError;

        // 2. Fetch all chapters for all studies
        const { data: chaptersData, error: chaptersError } = await supabase
          .from('chapters')
          .select('id, study_id, chapter_number, title');

        if (chaptersError) throw chaptersError;

        const chaptersByStudy: { [studyId: string]: ChapterFromDB[] } = {};
        chaptersData.forEach(chapter => {
          if (!chaptersByStudy[chapter.study_id]) {
            chaptersByStudy[chapter.study_id] = [];
          }
          chaptersByStudy[chapter.study_id].push(chapter);
        });

        // 3. Fetch all user progress to determine acquired studies and completed chapters
        let completedChapterIds = new Set<string>();
        let acquiredStudyIds = new Set<string>();

        const { data: allUserProgress, error: progressError } = await supabase
          .from('user_progress')
          .select('chapter_id, completed_at, study_id')
          .eq('user_id', userId);

        if (progressError) {
          console.error('Error fetching all user progress:', progressError);
        } else if (allUserProgress) {
          allUserProgress.forEach(p => {
            if (p.study_id) acquiredStudyIds.add(p.study_id);
            if (p.completed_at !== null) {
              completedChapterIds.add(p.chapter_id);
            }
          });
        }

        // Filter to only include acquired studies and calculate their progress
        const acquiredStudiesWithProgress: StudyWithProgress[] = studiesData
          .filter(study => acquiredStudyIds.has(study.id) || (isGabrielSpecialUser && !study.is_visible)) // Inclui estudos ocultos para o usuário especial
          .map(study => {
            const studyChapters = chaptersByStudy[study.id] || [];
            const totalChapters = studyChapters.length;
            
            const completedChapters = studyChapters.filter(chapter => completedChapterIds.has(chapter.id)).length;
            const progressPercentage = totalChapters > 0 ? (completedChapters / totalChapters) * 100 : 0;

            const threeDaysAgo = subDays(new Date(), 3);
            const isNew = isAfter(parseISO(study.created_at), threeDaysAgo) && completedChapters === 0; // NOVO: Condição para 'Novo'

            return {
              ...study,
              imageUrl: study.cover_image_url,
              completedChapters,
              totalChapters,
              progressPercentage,
              isAcquired: acquiredStudyIds.has(study.id), // Verifica se foi realmente adquirido
              isSpecialVisible: isGabrielSpecialUser && !study.is_visible, // Flag para aviso
              isNew: isNew, // NOVO: Adiciona a propriedade isNew
            };
          });

        setStudiesWithProgress(acquiredStudiesWithProgress);

      } catch (error: any) {
        console.error('Error fetching studies for library:', error);
        showError('Erro ao carregar seus estudos: ' + error.message);
        setStudiesWithProgress([]);
      } finally {
        setLoading(false);
      }
    };

    fetchStudiesAndProgress();
  }, [session, sessionLoading, isGabrielSpecialUser]);

  const sortedAndFilteredStudies = [...studiesWithProgress]
    .filter(study => {
      const query = searchQuery.toLowerCase();
      return (
        study.title.toLowerCase().includes(query) ||
        study.description.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name-asc':
          return a.title.localeCompare(b.title);
        case 'name-desc':
          return b.title.localeCompare(a.title);
        case 'progress-asc':
          return a.progressPercentage - b.progressPercentage;
        case 'progress-desc':
          return b.progressPercentage - a.progressPercentage;
        case 'created-at-desc':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'created-at-asc':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        default:
          return 0;
      }
    });

  if (loading || sessionLoading) {
    return (
      <div className="flex min-h-[calc(100vh-160px)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto">
      <h1 className="text-3xl font-bold mb-2 text-primary">Meus Estudos</h1>
      <p className="text-muted-foreground mb-6">Continue de onde parou ou comece uma nova jornada.</p>
      
      {studiesWithProgress.length > 0 && (
        <div className="mb-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Pesquisar em meus estudos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          {/* NOVO: Dropdown para ordenar */}
          <div className="flex items-center gap-2">
            <ListFilter className="h-5 w-5 text-muted-foreground" />
            <Select value={sortBy} onValueChange={(value: typeof sortBy) => setSortBy(value)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Organizar por..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name-asc">Nome (A-Z)</SelectItem>
                <SelectItem value="name-desc">Nome (Z-A)</SelectItem>
                <SelectItem value="progress-asc">Progresso (Crescente)</SelectItem>
                <SelectItem value="progress-desc">Progresso (Decrescente)</SelectItem>
                <SelectItem value="created-at-desc">Data de Adição (Mais Recente)</SelectItem>
                <SelectItem value="created-at-asc">Data de Adição (Mais Antiga)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {sortedAndFilteredStudies.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedAndFilteredStudies.map((study) => (
            <Card key={study.id} className="flex flex-col overflow-hidden">
              <img
                src={study.imageUrl}
                alt={`Capa do estudo ${study.title}`}
                className="w-full h-32 object-cover"
              />
              <CardHeader className="p-4">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg font-semibold leading-tight">{study.title}</CardTitle>
                  <div className="flex items-center gap-2">
                    {study.isNew && ( // NOVO: Renderiza o badge "Novo"
                      <Badge variant="default" className="bg-green-500 text-white text-xs px-2 py-1">
                        NOVO
                      </Badge>
                    )}
                    {study.isSpecialVisible && (
                      <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                        Visível apenas para você
                      </Badge>
                    )}
                  </div>
                </div>
                <CardDescription className="text-sm mt-1">{study.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow space-y-2 p-4">
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                  <span>Progresso:</span>
                  <span>{study.completedChapters} de {study.totalChapters}</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full" style={{ width: `${study.progressPercentage}%` }}></div>
                </div>
              </CardContent>
              <CardFooter className="p-4">
                <Button asChild className="w-full bg-primary hover:bg-primary/90">
                  <Link to={`/study/${study.id}`}>
                    {study.completedChapters === 0
                      ? "Começar Estudo"
                      : study.completedChapters === study.totalChapters
                        ? "Revisar Estudo"
                        : "Continuar Estudo"}
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 border-2 border-dashed rounded-lg">
            <BookOpen className="h-24 w-24 text-muted-foreground/50 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-primary">Nenhum estudo iniciado</h2>
            <p className="text-muted-foreground mt-2">Vá para a aba "Descobrir" para começar uma nova jornada de fé.</p>
            <Button asChild className="mt-4">
                <Link to="/store">Descobrir Estudos</Link>
            </Button>
        </div>
      )}
    </div>
  );
};

export default StudyLibrary;