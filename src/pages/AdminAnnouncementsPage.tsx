"use client";

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Megaphone, PlusCircle, Edit, Trash2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { showError, showSuccess } from '@/utils/toast';
import { AnnouncementForm } from '@/components/admin/AnnouncementForm';
import { useSession } from '@/contexts/SessionContext';
import { logAdminActivity } from '@/utils/logging';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Announcement {
  id: string;
  title: string;
  content: string;
  emoji: string | null;
  created_at: string;
}

const fetchAnnouncements = async (): Promise<Announcement[]> => {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

const AdminAnnouncementsPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session } = useSession();

  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);

  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [announcementToDelete, setAnnouncementToDelete] = useState<Announcement | null>(null);

  const { data: announcements, isLoading, error } = useQuery<Announcement[], Error>({
    queryKey: ['adminAnnouncements'],
    queryFn: fetchAnnouncements,
  });

  const handleCreateNewAnnouncement = () => {
    setEditingAnnouncement(null);
    setShowAnnouncementForm(true);
  };

  const handleEditAnnouncement = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setShowAnnouncementForm(true);
  };

  const handleDeleteAnnouncement = async () => {
    if (!announcementToDelete || !session?.user?.id) return;
    try {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', announcementToDelete.id);

      if (error) throw error;
      showSuccess('Anúncio removido com sucesso!');
      logAdminActivity(session.user.id, 'announcement_deleted', `Anúncio "${announcementToDelete.title}" (ID: ${announcementToDelete.id}) foi removido.`);
      queryClient.invalidateQueries({ queryKey: ['adminAnnouncements'] });
      setAnnouncementToDelete(null);
      setShowConfirmDelete(false);
    } catch (err: any) {
      showError('Erro ao remover anúncio: ' + err.message);
      console.error(err);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return format(new Date(timestamp), 'dd/MM/yyyy HH:mm', { locale: ptBR });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-160px)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-destructive p-8">
        <p>Erro ao carregar anúncios: {error.message}</p>
        <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['adminAnnouncements'] })} className="mt-4">
          Tentar Novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl pb-8">
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
          <Megaphone className="h-6 w-6" /> Gerenciar Anúncios
        </h1>
      </header>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ações Rápidas</CardTitle>
            <CardDescription>Crie novos anúncios para informar os usuários.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button className="w-full" onClick={handleCreateNewAnnouncement}>
              <PlusCircle className="h-4 w-4 mr-2" /> Criar Novo Anúncio
            </Button>
          </CardContent>
        </Card>

        <h2 className="text-xl font-bold text-primary mt-8 mb-4">Anúncios Existentes</h2>
        {announcements && announcements.length > 0 ? (
          <div className="grid gap-4">
            {announcements.map((announcement) => (
              <Card key={announcement.id} className="flex flex-col sm:flex-row items-start sm:items-center p-4 gap-4">
                <div className="flex-1 space-y-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {announcement.emoji && <span className="text-xl">{announcement.emoji}</span>}
                    {announcement.title}
                  </CardTitle>
                  <CardDescription className="text-sm line-clamp-2">{announcement.content}</CardDescription>
                  <p className="text-xs text-muted-foreground mt-1">Criado em: {formatTimestamp(announcement.created_at)}</p>
                </div>
                <div className="flex gap-2 mt-4 sm:mt-0">
                  <Button variant="outline" size="sm" onClick={() => handleEditAnnouncement(announcement)}>
                    <Edit className="h-4 w-4" />
                    <span className="sr-only sm:not-sr-only sm:ml-2">Editar</span>
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => { setAnnouncementToDelete(announcement); setShowConfirmDelete(true); }}>
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only sm:not-sr-only sm:ml-2">Excluir</span>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 border-2 border-dashed rounded-lg">
            <Megaphone className="h-24 w-24 text-muted-foreground/50 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-primary">Nenhum anúncio cadastrado</h2>
            <p className="text-muted-foreground mt-2">Comece criando seu primeiro anúncio acima.</p>
          </div>
        )}
      </div>

      {/* Dialog para o formulário de anúncio */}
      <Dialog open={showAnnouncementForm} onOpenChange={setShowAnnouncementForm}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAnnouncement ? 'Editar Anúncio' : 'Criar Novo Anúncio'}</DialogTitle>
          </DialogHeader>
          <AnnouncementForm
            announcement={editingAnnouncement || undefined}
            onSaveSuccess={() => {
              setShowAnnouncementForm(false);
              queryClient.invalidateQueries({ queryKey: ['adminAnnouncements'] });
            }}
            onCancel={() => setShowAnnouncementForm(false)}
          />
        </DialogContent>
      </Dialog>

      {/* AlertDialog para confirmar a exclusão de anúncio */}
      <AlertDialog open={showConfirmDelete} onOpenChange={setShowConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader className="flex flex-col items-center text-center">
            <Trash2 className="h-16 w-16 text-destructive mb-4" />
            <AlertDialogTitle className="text-2xl font-bold text-primary">Excluir Anúncio?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Tem certeza que deseja excluir o anúncio "{announcementToDelete?.title}"?
              Esta ação não pode ser desfeita.
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
                onClick={handleDeleteAnnouncement}
              >
                Excluir
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminAnnouncementsPage;