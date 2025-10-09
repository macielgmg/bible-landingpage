"use client";

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { useSession } from '@/contexts/SessionContext';
import { logAdminActivity } from '@/utils/logging';
import { MultiSelect } from '@/components/ui/MultiSelect'; // Importar MultiSelect
import { allContentTags } from '@/utils/contentTags'; // Importar as tags

const formSchema = z.object({
  title: z.string().min(1, "O título é obrigatório."),
  description: z.string().min(1, "A descrição é obrigatória."),
  cover_image_url: z.string().url("URL da imagem de capa inválida.").optional().or(z.literal('')),
  is_visible: z.boolean().default(false),
  chapter_title_display_format: z.enum(['title_only', 'chapter_number_only', 'chapter_and_page_number', 'part_title_only']).default('chapter_and_page_number'),
  tags: z.array(z.string()).optional(), // NOVO: Campo para tags
});

type StudyFormValues = z.infer<typeof formSchema>;

interface StudyFormProps {
  study?: {
    id: string;
    title: string;
    description: string;
    cover_image_url: string | null;
    is_visible: boolean;
    chapter_title_display_format: 'title_only' | 'chapter_number_only' | 'chapter_and_page_number' | 'part_title_only';
    tags: string[] | null; // NOVO: Adicionado tags
  };
  onSaveSuccess: () => void;
  onCancel: () => void;
}

export const StudyForm = ({ study, onSaveSuccess, onCancel }: StudyFormProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const { session } = useSession();

  const form = useForm<StudyFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: study?.title || '',
      description: study?.description || '',
      cover_image_url: study?.cover_image_url || '',
      is_visible: study?.is_visible ?? false,
      chapter_title_display_format: study?.chapter_title_display_format || 'chapter_and_page_number',
      tags: study?.tags || [], // NOVO: Default para array vazio
    },
  });

  useEffect(() => {
    if (study) {
      form.reset({
        title: study.title,
        description: study.description,
        cover_image_url: study.cover_image_url || '',
        is_visible: study.is_visible,
        chapter_title_display_format: study.chapter_title_display_format,
        tags: study.tags || [], // NOVO: Resetar tags
      });
    }
  }, [study, form]);

  const onSubmit = async (values: StudyFormValues) => {
    if (!session?.user?.id) {
      showError("Usuário administrador não identificado.");
      return;
    }
    setIsLoading(true);
    try {
      const payload = {
        title: values.title,
        description: values.description,
        cover_image_url: values.cover_image_url || null,
        is_visible: values.is_visible,
        chapter_title_display_format: values.chapter_title_display_format,
        tags: values.tags && values.tags.length > 0 ? values.tags : null, // NOVO: Salva tags
      };

      if (study) {
        const { error } = await supabase
          .from('studies')
          .update(payload)
          .eq('id', study.id);

        if (error) throw error;
        showSuccess('Estudo atualizado com sucesso!');
        logAdminActivity(session.user.id, 'study_updated', `Estudo "${values.title}" (ID: ${study.id}) foi atualizado.`);
      } else {
        const { error } = await supabase
          .from('studies')
          .insert(payload);

        if (error) throw error;
        showSuccess('Novo estudo criado com sucesso!');
        logAdminActivity(session.user.id, 'study_created', `Novo estudo "${values.title}" foi criado.`);
      }
      onSaveSuccess();
    } catch (error: any) {
      console.error('Erro ao salvar estudo:', error);
      showError('Erro ao salvar estudo: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4">
        <h2 className="text-2xl font-bold text-primary text-center mb-6">
          {study ? 'Editar Estudo' : 'Criar Novo Estudo'}
        </h2>

        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Título</FormLabel>
              <FormControl>
                <Input placeholder="Título do estudo" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição</FormLabel>
              <FormControl>
                <Textarea placeholder="Descrição detalhada do estudo" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="cover_image_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>URL da Imagem de Capa</FormLabel>
              <FormControl>
                <Input placeholder="https://exemplo.com/imagem.jpg" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="is_visible"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Visível no Aplicativo</FormLabel>
                <FormDescription>
                  Marque para que este estudo apareça na biblioteca e na loja do aplicativo.
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="chapter_title_display_format"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Formato do Título do Capítulo</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione como os títulos dos capítulos aparecerão" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="title_only">Apenas Título (Ex: O Caminho do Justo)</SelectItem>
                  <SelectItem value="chapter_number_only">Capítulo X: Título (Ex: Capítulo 1: O Caminho do Justo)</SelectItem>
                  <SelectItem value="chapter_and_page_number">Capítulo X.Y: Título (Ex: Capítulo 1.1: O Caminho do Justo)</SelectItem>
                  <SelectItem value="part_title_only">Parte X: Título (Ex: Parte 1: A Morte de Jesus)</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                Define como os títulos dos capítulos serão exibidos para os usuários.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* NOVO: Campo de MultiSelect para Tags */}
        <FormField
          control={form.control}
          name="tags"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tags (Opcional)</FormLabel>
              <FormControl>
                <MultiSelect
                  options={allContentTags}
                  selected={field.value || []}
                  onSelectedChange={field.onChange}
                  placeholder="Selecione as tags relevantes para este estudo"
                  disabled={isLoading}
                />
              </FormControl>
              <FormDescription>
                Tags ajudam a categorizar o estudo e podem ser usadas para filtragem.
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
            Salvar Estudo
          </Button>
        </div>
      </form>
    </Form>
  );
};