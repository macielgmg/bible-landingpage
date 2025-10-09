"use client";

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, XCircle } from 'lucide-react';
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
  chapter_number: z.coerce.number().min(1, "O número do capítulo é obrigatório e deve ser maior que 0."),
  page_number: z.coerce.number().min(1, "O número da página é obrigatório e deve ser maior que 0.").default(1), // NOVO: page_number
  title: z.string().min(1, "O título do capítulo é obrigatório."),
  bible_text: z.string().min(1, "O texto bíblico é obrigatório."),
  explanation: z.string().min(1, "A explicação é obrigatória."),
  application: z.string().min(1, "A aplicação prática é obrigatória."),
  audio_url: z.string().url("URL do áudio inválida.").optional().or(z.literal('')),
});

type ChapterFormValues = z.infer<typeof formSchema>;

interface ChapterFormProps {
  studyId: string;
  chapter?: {
    id: string;
    chapter_number: number;
    page_number: number; // NOVO: Adicionado page_number
    title: string;
    bible_text: string;
    explanation: string;
    application: string;
    audio_url: string | null;
  };
  onSaveSuccess: () => void;
  onCancel: () => void;
}

export const ChapterForm = ({ studyId, chapter, onSaveSuccess, onCancel }: ChapterFormProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const { session } = useSession();

  const form = useForm<ChapterFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      chapter_number: chapter?.chapter_number || 1,
      page_number: chapter?.page_number || 1, // NOVO: Default para 1
      title: chapter?.title || '',
      bible_text: chapter?.bible_text || '',
      explanation: chapter?.explanation || '',
      application: chapter?.application || '',
      audio_url: chapter?.audio_url || '',
    },
  });

  useEffect(() => {
    if (chapter) {
      form.reset({
        chapter_number: chapter.chapter_number,
        page_number: chapter.page_number, // NOVO: Resetar page_number
        title: chapter.title,
        bible_text: chapter.bible_text,
        explanation: chapter.explanation,
        application: chapter.application,
        audio_url: chapter.audio_url || '',
      });
    } else {
      // Quando criando um novo capítulo, tenta preencher o próximo número disponível
      const fetchNextChapterNumber = async () => {
        const { data, error } = await supabase
          .from('chapters')
          .select('chapter_number, page_number') // NOVO: Seleciona page_number
          .eq('study_id', studyId)
          .order('chapter_number', { ascending: false })
          .order('page_number', { ascending: false }) // NOVO: Ordena por page_number
          .limit(1)
          .single();
        
        if (!error && data) {
          // Se o último capítulo tem page_number, incrementa. Se não, assume 1.
          // Se o último capítulo tem page_number e é o último daquele chapter_number, incrementa chapter_number e reseta page_number.
          let nextChapterNum = data.chapter_number;
          let nextPageNum = (data.page_number || 0) + 1; // Assume 0 se for null, então 1

          // Lógica para determinar o próximo chapter_number e page_number
          // Por simplicidade, vamos apenas incrementar o page_number.
          // Se o usuário quiser um novo capítulo, ele pode ajustar manualmente.
          form.setValue('chapter_number', nextChapterNum);
          form.setValue('page_number', nextPageNum);
        } else {
          form.setValue('chapter_number', 1);
          form.setValue('page_number', 1);
        }
      };
      fetchNextChapterNumber();
    }
  }, [chapter, studyId, form]);

  const onSubmit = async (values: ChapterFormValues) => {
    if (!session?.user?.id) {
      showError("Usuário administrador não identificado.");
      return;
    }
    setIsLoading(true);
    try {
      if (chapter) {
        // Update existing chapter
        const { error } = await supabase
          .from('chapters')
          .update({
            chapter_number: values.chapter_number,
            page_number: values.page_number, // NOVO: Atualiza page_number
            title: values.title,
            bible_text: values.bible_text,
            explanation: values.explanation,
            application: values.application,
            audio_url: values.audio_url || null,
          })
          .eq('id', chapter.id);

        if (error) throw error;
        showSuccess('Capítulo atualizado com sucesso!');
        logAdminActivity(session.user.id, 'chapter_updated', `Capítulo "${values.title}" (ID: ${chapter.id}) do estudo ${studyId} foi atualizado.`);
      } else {
        // Insert new chapter
        const { error } = await supabase
          .from('chapters')
          .insert({
            study_id: studyId,
            chapter_number: values.chapter_number,
            page_number: values.page_number, // NOVO: Insere page_number
            title: values.title,
            bible_text: values.bible_text,
            explanation: values.explanation,
            application: values.application,
            audio_url: values.audio_url || null,
          });

        if (error) throw error;
        showSuccess('Novo capítulo criado com sucesso!');
        logAdminActivity(session.user.id, 'chapter_created', `Novo capítulo "${values.title}" (número: ${values.chapter_number}.${values.page_number}) foi criado para o estudo ${studyId}.`);
      }
      onSaveSuccess();
    } catch (error: any) {
      console.error('Erro ao salvar capítulo:', error);
      showError('Erro ao salvar capítulo: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4">
        <h2 className="text-2xl font-bold text-primary text-center mb-6">
          {chapter ? 'Editar Capítulo' : 'Adicionar Novo Capítulo'}
        </h2>

        <FormField
          control={form.control}
          name="chapter_number"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Número do Capítulo</FormLabel>
              <FormControl>
                <Input type="number" placeholder="Ex: 1" {...field} onChange={e => field.onChange(e.target.valueAsNumber)} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="page_number" // NOVO: Campo para page_number
          render={({ field }) => (
            <FormItem>
              <FormLabel>Número da Página</FormLabel>
              <FormControl>
                <Input type="number" placeholder="Ex: 1" {...field} onChange={e => field.onChange(e.target.valueAsNumber)} />
              </FormControl>
              <FormDescription>
                Define a ordem das páginas dentro de um mesmo capítulo.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Título do Capítulo</FormLabel>
              <FormControl>
                <Input placeholder="Ex: O Caminho do Justo" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="bible_text"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Texto Bíblico</FormLabel>
              <FormControl>
                <Textarea placeholder="Cole o texto bíblico aqui..." className="min-h-[150px]" {...field} />
              </FormControl>
              <FormDescription>
                O texto principal do capítulo.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="explanation"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Explicação</FormLabel>
              <FormControl>
                <Textarea placeholder="Explicação do texto bíblico..." className="min-h-[150px]" {...field} />
              </FormControl>
              <FormDescription>
                Uma análise e contextualização do texto.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="application"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Aplicação Prática</FormLabel>
              <FormControl>
                <Textarea placeholder="Como aplicar este ensino na vida diária..." className="min-h-[150px]" {...field} />
              </FormControl>
              <FormDescription>
                Sugestões de como o usuário pode aplicar o ensino.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="audio_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>URL do Áudio (Opcional)</FormLabel>
              <FormControl>
                <Input placeholder="https://exemplo.com/audio.mp3" {...field} />
              </FormControl>
              <FormDescription>
                Link para um arquivo de áudio do capítulo (recurso Pro).
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
            Salvar Capítulo
          </Button>
        </div>
      </form>
    </Form>
  );
};