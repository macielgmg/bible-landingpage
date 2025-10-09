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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Search, ListFilter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { showError, showStudyAcquiredToast } from '@/utils/toast';
import { cn } from '@/lib/utils';
import { logUserActivity } from '@/utils/logging';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"; // Importar Select
import { isAfter, subDays, parseISO } from 'date-fns'; // Importar funções de data

interface StudyFromDB {
  id: string;
  title: string;
  description: string;
  cover_image_url: string;
  is_visible: boolean;
  tags: string[] | null;
  created_at: string; // Adicionado para ordenação
}

interface ChapterFromDB {
  id: string;
  study_id: string;
  chapter_number: number;
  title: string;
}

interface StudyWithAcquisitionStatus extends StudyFromDB {
  imageUrl: string;
  isAcquired: boolean;
  isSpecialVisible?: boolean;
  // Removido: isNew?: boolean; // NOVO: Propriedade para indicar se o estudo é novo
}

const Store = () => {
  const { session, loading: sessionLoading, setNewStudyNotification, isGabrielSpecialUser } = useSession(); 
  const navigate = useNavigate();
  const [availableStudies, setAvailableStudies] = useState<StudyWithAcquisitionStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'created-at-desc' | 'name-asc' | 'name-desc'>('created-at-desc'); // NOVO: Estado para a ordenação
  const [acquiringStudyId, setAcquiringStudyId] = useState<string | null>(null);
  const [acquiringProgress, setAcquiringProgress] = useState(0);

  useEffect(() => {
    const fetchStudiesAndAcquisitionStatus = async () => {
      if (sessionLoading) return;

      setLoading(true);
      const userId = session?.user?.id;

      try {
        // 1. Fetch all studies from the database
        let studiesQuery = supabase
          .from('studies')
          .select('*');
        
        // Aplicar ordenação
        if (sortBy === 'created-at-desc') {
          studiesQuery = studiesQuery.order('created_at', { ascending: false });
        } else if (sortBy === 'name-asc') {
          studiesQuery = studiesQuery.order('title', { ascending: true });
        } else if (sortBy === 'name-desc') {
          studiesQuery = studiesQuery.order('title', { ascending: false });
        }

        // Se não for o usuário especial, filtra por is_visible = true
        if (!isGabrielSpecialUser) {
          studiesQuery = studiesQuery.eq('is_visible', true);
        }

        const { data: studiesData, error: studiesError } = await studiesQuery;

        if (studiesError) throw studiesError;

        // 2. Fetch all user progress to determine acquired studies (if user is logged in)
        let acquiredStudyIds = new Set<string>();

        if (userId) {
          const { data: allUserProgress, error: progressError } = await supabase
            .from('user_progress')
            .select('study_id')
            .eq('user_id', userId);

          if (progressError) {
            console.error('Error fetching user progress for acquisition status:', progressError);
          } else if (allUserProgress) {
            allUserProgress.forEach(p => {
              if (p.study_id) acquiredStudyIds.add(p.study_id);
            });
          }
        }

        // Filter out already acquired studies for the 'Discover' page
        const unacquiredStudies: StudyWithAcquisitionStatus[] = studiesData
          .filter(study => !acquiredStudyIds.has(study.id) || (isGabrielSpecialUser && !study.is_visible))
          .map(study => {
            // Removido: const threeDaysAgo = subDays(new Date(), 3);
            // Removido: const isNew = isAfter(parseISO(study.created_at), threeDaysAgo); // Verifica se foi criado nos últimos 3 dias
            
            return {
              ...study,
              imageUrl: study.cover_image_url,
              isAcquired: acquiredStudyIds.has(study.id),
              isSpecialVisible: isGabrielSpecialUser && !study.is_visible,
              // Removido: isNew: isNew && !acquiredStudyIds.has(study.id), // 'Novo' apenas se for recente E não adquirido
            };
          });

        setAvailableStudies(unacquiredStudies);

      } catch (error: any) {
        console.error('Error fetching studies for discover page:', error);
        showError('Erro ao carregar estudos para descobrir: ' + error.message);
        setAvailableStudies([]);
      } finally {
        setLoading(false);
      }
    };

    fetchStudiesAndAcquisitionStatus();
  }, [session, sessionLoading, isGabrielSpecialUser, sortBy]); // Adicionado sortBy como dependência

  const handleAcquireStudy = async (studyId: string, studyTitle: string) => { 
    if (!session?.user) {
      showError("Você precisa estar logado para adquirir um estudo.");
      return;
    }

    setAcquiringStudyId(studyId);
    setAcquiringProgress(0);

    let currentProgress = 0;
    const progressInterval = setInterval(() => {
      currentProgress += 10;
      if (currentProgress >= 90) {
        clearInterval(progressInterval);
        setAcquiringProgress(90);
      } else {
        setAcquiringProgress(currentProgress);
      }
    }, 100);

    try {
      const { data: chapters, error: chapterError } = await supabase
        .from('chapters')
        .select('id')
        .eq('study_id', studyId)
        .order('chapter_number', { ascending: true })
        .limit(1);

      if (chapterError) throw chapterError;
      
      const firstChapter = chapters && chapters.length > 0 ? chapters[0] : null;

      if (!firstChapter) {
        showError("Capítulos não encontrados para este estudo.");
        return;
      }

      const { error: insertError } = await supabase
        .from('user_progress')
        .insert({
          user_id: session.user.id,
          study_id: studyId,
          chapter_id: firstChapter.id,
          notes: '',
          completed_at: null,
        });

      if (insertError) {
        if (insertError.code === '23505') {
          showError("Você já adquiriu este estudo.");
        } else {
          showError("Erro ao adquirir o estudo: " + insertError.message);
        }
        return;
      }

      clearInterval(progressInterval);
      setAcquiringProgress(100);
      showStudyAcquiredToast({ title: studyTitle, studyId: studyId });
      setNewStudyNotification(true);
      
      logUserActivity(session.user.id, 'study_acquired', `Adquiriu o estudo "${studyTitle}".`);

      // Atualiza o estado para remover o estudo da lista de 'disponíveis' e garantir que o badge 'Novo' suma
      setAvailableStudies(prevItems => prevItems.filter(item => item.id !== studyId));

      setTimeout(() => {
        setAcquiringStudyId(null);
        setAcquiringProgress(0);
      }, 300); 

    } catch (error: any) {
      clearInterval(progressInterval);
      setAcquiringProgress(0);
      setAcquiringStudyId(null);
      console.error("Erro inesperado ao adquirir estudo:", error);
      showError("Ocorreu um erro inesperado: " + error.message);
    } finally {
    }
  };

  const filteredItems = availableStudies
    .filter(item => {
      const query = searchQuery.toLowerCase();
      return (
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query)
      );
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
      <h1 className="text-3xl font-bold mb-2 text-primary">Descobrir Novos Estudos</h1>
      <p className="text-muted-foreground mb-6">Encontre novos módulos para aprofundar suas raízes na fé.</p>

      <div className="mb-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Pesquisar estudos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        {/* NOVO: Select para ordenar */}
        <div className="flex items-center gap-2">
          <ListFilter className="h-5 w-5 text-muted-foreground" />
          <Select value={sortBy} onValueChange={(value: typeof sortBy) => setSortBy(value)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Organizar por..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created-at-desc">Adicionados Recentemente</SelectItem>
              <SelectItem value="name-asc">Nome (A-Z)</SelectItem>
              <SelectItem value="name-desc">Nome (Z-A)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredItems.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => (
            <Card key={item.id} className="flex flex-col overflow-hidden">
              <img
                src={item.imageUrl}
                alt={`Capa do estudo ${item.title}`}
                className="w-full h-32 object-cover"
              />
              <CardHeader className="p-4">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg font-semibold leading-tight">{item.title}</CardTitle>
                  <div className="flex items-center gap-2">
                    {/* Removido: item.isNew && ( // Renderiza o badge "Novo"
                      <Badge variant="default" className="bg-green-500 text-white text-xs px-2 py-1">
                        NOVO
                      </Badge>
                    ) */}
                    {item.isSpecialVisible && (
                      <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                        Visível apenas para você
                      </Badge>
                    )}
                  </div>
                </div>
                <CardDescription className="text-sm mt-1">{item.description}</CardDescription>
                {item.tags && item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {item.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-4 pt-0">
              </CardContent>
              <CardFooter className="p-4 pt-0">
                <Button
                  onClick={() => handleAcquireStudy(item.id, item.title)} 
                  className={cn(
                    "w-full bg-primary hover:bg-primary/90 relative overflow-hidden",
                    acquiringStudyId === item.id && "text-transparent"
                  )}
                  disabled={acquiringStudyId === item.id}
                >
                  {acquiringStudyId === item.id && (
                    <>
                      <div
                        className="absolute inset-0 bg-primary/50 transition-all duration-100 ease-linear"
                        style={{ width: `${acquiringProgress}%` }}
                      />
                      <span className="relative z-10 flex items-center justify-center text-primary-foreground">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Adquirindo...
                      </span>
                    </>
                  )}
                  {acquiringStudyId !== item.id && "Adquirir Estudo"}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 border-2 border-dashed rounded-lg">
          <h2 className="text-xl font-semibold text-primary">Nenhum novo estudo encontrado</h2>
          <p className="text-muted-foreground mt-2">Você já adquiriu todos os estudos disponíveis ou não há novos estudos que correspondam à sua busca.</p>
        </div>
      )}
    </div>
  );
};

export default Store;