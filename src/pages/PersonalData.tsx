import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Camera, Loader2, Save, Edit, XCircle } from 'lucide-react'; // Adicionado Edit e XCircle
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { AgeInput } from '@/components/AgeInput';
import { GenderSelect } from '@/components/GenderSelect';
import { cn } from '@/lib/utils'; // Importar cn para combinar classes

const PersonalData = () => {
  const navigate = useNavigate();
  const { session, avatarUrl, refetchProfile, quizResponses } = useSession();

  const [firstName, setFirstName] = useState('');
  const [initialFirstName, setInitialFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [initialLastName, setInitialLastName] = useState('');
  
  const [currentAge, setCurrentAge] = useState<number | null>(null);
  const [initialAge, setInitialAge] = useState<number | null>(null);
  const [currentGender, setCurrentGender] = useState<string | null>(null);
  const [initialGender, setInitialGender] = useState<string | null>(null);

  const [savingProfile, setSavingProfile] = useState(false);
  const [loadingProfileData, setLoadingProfileData] = useState(true);
  const [isEditing, setIsEditing] = useState(false); // NOVO: Estado para controlar o modo de edição

  const getInitials = (first: string | null | undefined, last: string | null | undefined, email: string | null | undefined) => {
    if (first && last) {
      return `${first[0]}${last[0]}`.toUpperCase();
    }
    if (first) {
      return first.substring(0, 2).toUpperCase();
    }
    if (email) {
      return email.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  const genderOptions = [
    { value: 'masculino', label: 'Masculino' },
    { value: 'feminino', label: 'Feminino' },
    { value: 'nao-informar', label: 'Prefiro não informar' },
  ];

  const ageConfig = { min: 10, max: 90, step: 1 };

  const fetchCurrentProfileData = useCallback(async () => {
    if (!session?.user) {
      setLoadingProfileData(false);
      return;
    }
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('first_name, last_name, quiz_responses')
      .eq('id', session.user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Erro ao carregar perfil para Dados Pessoais:', error);
      showError('Erro ao carregar dados do perfil.');
      setLoadingProfileData(false);
      return;
    } 
    
    if (profile) {
      setFirstName(profile.first_name || '');
      setInitialFirstName(profile.first_name || '');
      setLastName(profile.last_name || '');
      setInitialLastName(profile.last_name || '');

      if (profile.quiz_responses) {
        try {
          const parsedQuizResponses = JSON.parse(profile.quiz_responses);
          setCurrentAge(parsedQuizResponses.q1_age || null);
          setInitialAge(parsedQuizResponses.q1_age || null);
          setCurrentGender(parsedQuizResponses.q1_gender || null);
          setInitialGender(parsedQuizResponses.q1_gender || null);
        } catch (parseError) {
          console.error('Erro ao analisar quiz_responses para idade e gênero:', parseError);
          setCurrentAge(null);
          setInitialAge(null);
          setCurrentGender(null);
          setInitialGender(null);
        }
      } else {
        setCurrentAge(null);
        setInitialAge(null);
        setCurrentGender(null);
        setInitialGender(null);
      }
    } else {
      setFirstName(session.user.user_metadata.first_name || '');
      setInitialFirstName(session.user.user_metadata.first_name || '');
      setLastName(session.user.user_metadata.last_name || '');
      setInitialLastName(session.user.user_metadata.last_name || '');
      setCurrentAge(null);
      setInitialAge(null);
      setCurrentGender(null);
      setInitialGender(null);
    }
    setLoadingProfileData(false);
  }, [session]);

  useEffect(() => {
    fetchCurrentProfileData();
  }, [fetchCurrentProfileData]);

  const handleSaveProfile = async () => {
    if (!session?.user) return;
    setSavingProfile(true);

    let updatedQuizResponses = quizResponses ? JSON.parse(quizResponses) : {};
    updatedQuizResponses = {
      ...updatedQuizResponses,
      q1_age: currentAge,
      q1_gender: currentGender,
    };

    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: firstName,
        last_name: lastName,
        quiz_responses: JSON.stringify(updatedQuizResponses),
      })
      .eq('id', session.user.id);

    if (error) {
      showError("Não foi possível atualizar o perfil.");
      console.error(error);
    } else {
      showSuccess("Perfil atualizado com sucesso!");
      await refetchProfile(); // Atualiza o contexto da sessão
      setInitialFirstName(firstName);
      setInitialLastName(lastName);
      setInitialAge(currentAge);
      setInitialGender(currentGender);
      setIsEditing(false); // Sai do modo de edição após salvar
    }
    setSavingProfile(false);
  };

  const handleCancelEdit = () => {
    // Reverte para os valores iniciais
    setFirstName(initialFirstName);
    setLastName(initialLastName);
    setCurrentAge(initialAge);
    setCurrentGender(initialGender);
    setIsEditing(false); // Sai do modo de edição
  };

  const hasChanges = 
    firstName !== initialFirstName ||
    lastName !== initialLastName ||
    currentAge !== initialAge ||
    currentGender !== initialGender;

  if (loadingProfileData) {
    return (
      <div className="flex min-h-[calc(100vh-160px)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl">
      <header className="relative flex items-center justify-center py-4 mb-4">
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-0"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold text-primary">Informações Pessoais</h1>
      </header>

      <Card className="p-6 space-y-6">
        {/* Seção de Avatar e Nome */}
        <div className="flex flex-col items-center space-y-2 pt-2 pb-4">
          <div className="relative">
            <Avatar className="h-24 w-24 border-2 border-primary/20">
              <AvatarImage src={avatarUrl || undefined} alt="Foto do perfil" />
              <AvatarFallback className="text-3xl bg-secondary">{getInitials(firstName, lastName, session?.user?.email)}</AvatarFallback>
            </Avatar>
            <div className="absolute bottom-0 right-0 bg-primary p-2 rounded-full border-2 border-background">
              <Camera className="h-4 w-4 text-white" />
            </div>
          </div>
          <div className="text-center w-full">
            <h2 className="text-2xl font-bold text-primary">
              {[firstName, lastName].filter(Boolean).join(' ') || 'Usuário'}
            </h2>
          </div>
        </div>

        {/* Campos do Formulário ou Visualização */}
        <div className="space-y-4">
          {isEditing ? (
            <>
              {/* Primeiro Nome */}
              <div>
                <Label htmlFor="firstName">Primeiro Nome</Label>
                <Input
                  id="firstName"
                  placeholder="Seu primeiro nome"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="mt-1"
                  disabled={savingProfile}
                />
              </div>

              {/* Sobrenome */}
              <div>
                <Label htmlFor="lastName">Sobrenome</Label>
                <Input
                  id="lastName"
                  placeholder="Seu sobrenome"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="mt-1"
                  disabled={savingProfile}
                />
              </div>

              {/* Idade */}
              <AgeInput
                initialAge={currentAge}
                onAgeChange={setCurrentAge}
                min={ageConfig.min}
                max={ageConfig.max}
                step={ageConfig.step}
                disabled={savingProfile}
              />

              {/* Gênero */}
              <GenderSelect
                initialGender={currentGender}
                onGenderChange={setCurrentGender}
                options={genderOptions}
                disabled={savingProfile}
              />
            </>
          ) : (
            <>
              {/* Visualização de Nome Completo */}
              <div className="flex items-center justify-between p-3 border rounded-md bg-secondary/30">
                <Label className="text-base font-medium text-primary/90">Nome Completo:</Label>
                <span className="text-base text-foreground">
                  {[firstName, lastName].filter(Boolean).join(' ') || 'Não informado'}
                </span>
              </div>

              {/* Visualização de Idade */}
              <div className="flex items-center justify-between p-3 border rounded-md bg-secondary/30">
                <Label className="text-base font-medium text-primary/90">Idade:</Label>
                <span className="text-base text-foreground">
                  {currentAge ? `${currentAge} anos` : 'Não informado'}
                </span>
              </div>

              {/* Visualização de Gênero */}
              <div className="flex items-center justify-between p-3 border rounded-md bg-secondary/30">
                <Label className="text-base font-medium text-primary/90">Gênero:</Label>
                <span className="text-base text-foreground">
                  {currentGender ? genderOptions.find(opt => opt.value === currentGender)?.label || currentGender : 'Não informado'}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Botões de Ação */}
        {isEditing ? (
          <div className="flex gap-2 mt-6">
            <Button 
              variant="outline" 
              onClick={handleCancelEdit} 
              disabled={savingProfile}
              className="flex-1"
            >
              <XCircle className="h-4 w-4 mr-2" /> Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={handleSaveProfile}
              disabled={savingProfile || !hasChanges}
            >
              {savingProfile ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar
            </Button>
          </div>
        ) : (
          <Button
            className="w-full mt-6"
            onClick={() => setIsEditing(true)}
            disabled={savingProfile}
          >
            <Edit className="h-4 w-4 mr-2" /> Editar Informações Pessoais
          </Button>
        )}
      </Card>
    </div>
  );
};

export default PersonalData;