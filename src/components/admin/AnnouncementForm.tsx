"use client";

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, XCircle, Smile } from 'lucide-react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { useSession } from '@/contexts/SessionContext';
import { logAdminActivity } from '@/utils/logging';

const formSchema = z.object({
  title: z.string().min(1, "O título do anúncio é obrigatório."),
  content: z.string().min(1, "O conteúdo do anúncio é obrigatório."),
  emoji: z.string().optional(),
});

type AnnouncementFormValues = z.infer<typeof formSchema>;

interface AnnouncementFormProps {
  announcement?: {
    id: string;
    title: string;
    content: string;
    emoji: string | null;
  };
  onSaveSuccess: () => void;
  onCancel: () => void;
}

export const AnnouncementForm = ({ announcement, onSaveSuccess, onCancel }: AnnouncementFormProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const { session } = useSession();

  const form = useForm<AnnouncementFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: announcement?.title || '',
      content: announcement?.content || '',
      emoji: announcement?.emoji || '',
    },
  });

  useEffect(() => {
    if (announcement) {
      form.reset({
        title: announcement.title,
        content: announcement.content,
        emoji: announcement.emoji || '',
      });
    }
  }, [announcement, form]);

  const onSubmit = async (values: AnnouncementFormValues) => {
    if (!session?.user?.id) {
      showError("Usuário administrador não identificado.");
      return;
    }
    setIsLoading(true);
    try {
      const payload = {
        title: values.title,
        content: values.content,
        emoji: values.emoji || null,
      };

      if (announcement) {
        // Update existing announcement
        const { error } = await supabase
          .from('announcements')
          .update(payload)
          .eq('id', announcement.id);

        if (error) throw error;
        showSuccess('Anúncio atualizado com sucesso!');
        logAdminActivity(session.user.id, 'announcement_updated', `Anúncio "${values.title}" (ID: ${announcement.id}) foi atualizado.`);
      } else {
        // Insert new announcement
        const { error } = await supabase
          .from('announcements')
          .insert(payload);

        if (error) throw error;
        showSuccess('Novo anúncio criado com sucesso!');
        logAdminActivity(session.user.id, 'announcement_created', `Novo anúncio "${values.title}" foi criado.`);
      }
      onSaveSuccess();
    } catch (error: any) {
      console.error('Erro ao salvar anúncio:', error);
      showError('Erro ao salvar anúncio: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4">
        <h2 className="text-2xl font-bold text-primary text-center mb-6">
          {announcement ? 'Editar Anúncio' : 'Criar Novo Anúncio'}
        </h2>

        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Título do Anúncio</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Nova Funcionalidade Lançada!" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Conteúdo do Anúncio</FormLabel>
              <FormControl>
                <Textarea placeholder="Descreva o que há de novo ou importante..." className="min-h-[120px]" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="emoji"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Emoji (Opcional)</FormLabel>
              <FormControl>
                <Input placeholder="Ex: ✨, 🎉, 🔔" {...field} />
              </FormControl>
              <FormDescription>
                Um emoji para destacar o anúncio no pop-up.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 mt-6">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            <XCircle className="h-4 w-4 mr-2" /> Cancelar
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar Anúncio
          </Button>
        </div>
      </form>
    </Form>
  );
};