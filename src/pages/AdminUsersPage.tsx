"use client";

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users, PlusCircle, Loader2, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
} from "@/components/ui/alert-dialog";
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { logAdminActivity } from '@/utils/logging';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface AuthorizedUser {
  id: string;
  email: string;
  created_at: string;
}

// Interface para os dados do perfil do usuário, agora correspondendo EXATAMENTE ao RPC get_user_stats
interface UserProfile {
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  streak_count: number;
  last_streak_date: string | null;
  total_journal_entries: number;
  total_shares: number;
  chapters_completed: number; // bigint no SQL, number no TS
  last_activity_date: string | null; // timestamp with time zone no SQL, string | null no TS
}

const fetchAuthorizedUsers = async (): Promise<AuthorizedUser[]> => {
  const { data, error } = await supabase
    .from('authorized_users')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

// Função para buscar os perfis dos usuários
const fetchUserProfiles = async (): Promise<UserProfile[]> => {
  console.log('AdminUsersPage: Attempting to call get_user_stats RPC...');
  const { data, error } = await supabase.rpc('get_user_stats');

  if (error) {
    console.error('AdminUsersPage: Error calling get_user_stats RPC:', error);
    throw error;
  }

  console.log('AdminUsersPage: Raw data from get_user_stats RPC:', data);

  // Mapear os dados diretamente para a interface UserProfile
  return data.map(profile => ({
    user_id: profile.user_id,
    email: profile.email,
    first_name: profile.first_name,
    last_name: profile.last_name,
    streak_count: profile.streak_count,
    last_streak_date: profile.last_streak_date,
    total_journal_entries: profile.total_journal_entries,
    total_shares: profile.total_shares,
    chapters_completed: profile.chapters_completed || 0,
    last_activity_date: profile.last_activity_date,
  }));
};

const AdminUsersPage = () => {
  const navigate = useNavigate();
  const { session } = useSession();
  const queryClient = useQueryClient();

  const [newAuthorizedEmail, setNewAuthorizedEmail] = useState('');
  const [isAddingAuthorizedUser, setIsAddingAuthorizedUser] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [userToDelete, setUserToDelete] = useState<AuthorizedUser | null>(null);

  const { data: authorizedUsers, isLoading: isLoadingAuthorizedUsers, error: authorizedUsersError } = useQuery<AuthorizedUser[], Error>({
    queryKey: ['authorizedUsers'],
    queryFn: fetchAuthorizedUsers,
  });

  // Query para buscar os perfis dos usuários
  const { data: userProfiles, isLoading: isLoadingUserProfiles, error: userProfilesError } = useQuery<UserProfile[], Error>({
    queryKey: ['userProfiles'],
    queryFn: fetchUserProfiles,
    // Os logs de sucesso e erro já estão dentro de `fetchUserProfiles`,
    // então não precisamos duplicá-los aqui nas opções do `useQuery`.
  });

  const handleAddAuthorizedUser = async () => {
    if (!newAuthorizedEmail) {
      showError("Por favor, insira um email.");
      return;
    }
    setIsAddingAuthorizedUser(true);
    try {
      const { data, error } = await supabase
        .from('authorized_users')
        .insert({ email: newAuthorizedEmail });

      if (error) {
        throw error;
      }
      showSuccess(`Email ${newAuthorizedEmail} autorizado com sucesso para cadastro!`);
      logAdminActivity(session?.user?.id || 'unknown', 'authorized_user_added', `Email ${newAuthorizedEmail} autorizado.`);
      setNewAuthorizedEmail('');
      queryClient.invalidateQueries({ queryKey: ['authorizedUsers'] }); // Invalidate to refetch list
    } catch (error: any) {
      if (error.code === '23505') { // Unique violation
        showError("Este email já está autorizado.");
      } else {
        showError("Erro ao adicionar usuário autorizado: " + error.message);
      }
      console.error("Erro ao adicionar usuário autorizado:", error);
    } finally {
      setIsAddingAuthorizedUser(false);
    }
  };

  const handleDeleteAuthorizedUser = async () => {
    if (!userToDelete || !session?.user?.id) return;

    try {
      const { error } = await supabase
        .from('authorized_users')
        .delete()
        .eq('id', userToDelete.id);

      if (error) throw error;
      showSuccess(`Email ${userToDelete.email} removido da lista de autorizados.`);
      logAdminActivity(session.user.id, 'authorized_user_deleted', `Email ${userToDelete.email} desautorizado.`);
      queryClient.invalidateQueries({ queryKey: ['authorizedUsers'] });
      setUserToDelete(null);
      setShowConfirmDelete(false);
    } catch (err: any) {
      showError('Erro ao remover usuário autorizado: ' + err.message);
      console.error(err);
    }
  };

  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return '-';
    return format(parseISO(timestamp), 'dd/MM/yyyy HH:mm', { locale: ptBR });
  };

  return (
    <div className="container mx-auto max-w-4xl pb-8">
      <header className="relative flex items-center justify-center py-4 mb-4">
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute left-0"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold text-primary flex items-center gap-2">
          <Users className="h-6 w-6" /> Gerenciar Usuários
        </h1>
      </header>

      <div className="space-y-6">
        {/* Adicionar Email Autorizado */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Adicionar Email Autorizado</CardTitle>
            <CardDescription>Permita que novos usuários se cadastrem no aplicativo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="authorized-email">Email para Autorizar</Label>
              <Input
                id="authorized-email"
                type="email"
                placeholder="email@example.com"
                value={newAuthorizedEmail}
                onChange={(e) => setNewAuthorizedEmail(e.target.value)}
                className="mt-1"
              />
            </div>
            <Button 
              onClick={handleAddAuthorizedUser} 
              disabled={isAddingAuthorizedUser || !newAuthorizedEmail} 
              className="w-full"
            >
              {isAddingAuthorizedUser ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PlusCircle className="h-4 w-4 mr-2" />}
              Adicionar Usuário Autorizado
            </Button>
          </CardContent>
        </Card>

        {/* Lista de Usuários Autorizados */}
        <Card>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="authorized-emails" className="border-none">
              <AccordionTrigger className="flex items-center justify-between rounded-t-lg p-4 text-lg font-semibold text-primary hover:no-underline">
                Emails Autorizados
              </AccordionTrigger>
              <AccordionContent className="p-0">
                <CardDescription className="px-4 pb-2">Emails que têm permissão para criar uma conta.</CardDescription>
                <CardContent className="p-0">
                  {isLoadingAuthorizedUsers ? (
                    <div className="flex justify-center items-center h-32">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : authorizedUsersError ? (
                    <p className="text-destructive text-center p-4">Erro ao carregar emails autorizados: {authorizedUsersError.message}</p>
                  ) : authorizedUsers && authorizedUsers.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Email</TableHead>
                            <TableHead>Data de Autorização</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {authorizedUsers.map((user) => (
                            <TableRow key={user.id}>
                              <TableCell className="text-sm">{user.email}</TableCell>
                              <TableCell className="text-xs">{formatTimestamp(user.created_at)}</TableCell>
                              <TableCell className="text-right">
                                <Button 
                                  variant="destructive" 
                                  size="sm" 
                                  onClick={() => { setUserToDelete(user); setShowConfirmDelete(true); }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Excluir</span>
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground p-4">Nenhum email autorizado encontrado.</p>
                  )}
                </CardContent>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Card>

        {/* Seção de Perfis de Usuários Registrados */}
        <Card>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="registered-user-profiles" className="border-none">
              <AccordionTrigger className="flex items-center justify-between rounded-t-lg p-4 text-lg font-semibold text-primary hover:no-underline">
                Perfis de Usuários Registrados
              </AccordionTrigger>
              <AccordionContent className="p-0">
                <CardDescription className="px-4 pb-2">Usuários que já se cadastraram no aplicativo.</CardDescription>
                <CardContent className="p-0">
                  {isLoadingUserProfiles ? (
                    <div className="flex justify-center items-center h-32">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : userProfilesError ? (
                    <p className="text-destructive text-center p-4">Erro ao carregar perfis de usuários: {userProfilesError.message}</p>
                  ) : userProfiles && userProfiles.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>ID do Usuário</TableHead>
                            <TableHead>Nome Completo</TableHead>
                            <TableHead>Capítulos Concluídos</TableHead>
                            <TableHead>Entradas no Diário</TableHead>
                            <TableHead>Compartilhamentos</TableHead>
                            <TableHead>Última Atividade</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {userProfiles.map((profile) => (
                            <TableRow key={profile.user_id}>
                              <TableCell className="text-sm">{profile.user_id.substring(0, 8)}...</TableCell>
                              <TableCell className="text-sm">
                                {profile.first_name || ''} {profile.last_name || ''}
                              </TableCell>
                              <TableCell className="text-sm">{profile.chapters_completed}</TableCell>
                              <TableCell className="text-sm">{profile.total_journal_entries}</TableCell>
                              <TableCell className="text-sm">{profile.total_shares}</TableCell>
                              <TableCell className="text-xs">{formatTimestamp(profile.last_activity_date)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground p-4">Nenhum perfil de usuário registrado encontrado.</p>
                  )}
                </CardContent>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Card>
      </div>

      {/* AlertDialog para confirmar a exclusão de usuário autorizado */}
      <AlertDialog open={showConfirmDelete} onOpenChange={setShowConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader className="flex flex-col items-center text-center">
            <Trash2 className="h-16 w-16 text-destructive mb-4" />
            <AlertDialogTitle className="text-2xl font-bold text-primary">Excluir Usuário Autorizado?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Tem certeza que deseja remover o email "<span className="font-bold text-primary">{userToDelete?.email}</span>" da lista de autorizados?
              Este usuário não poderá mais criar uma conta com este email. Esta ação não pode ser desfeita.
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
                onClick={handleDeleteAuthorizedUser}
              >
                Excluir Usuário
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminUsersPage;