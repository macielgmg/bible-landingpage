"use client";

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Loader2, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Logo } from '@/components/Logo';

// Esquema de validação para a nova senha
const newPasswordSchema = z.object({
  newPassword: z.string().min(6, "A nova senha deve ter pelo menos 6 caracteres."),
  confirmNewPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: "As senhas não coincidem.",
  path: ["confirmNewPassword"],
});

type NewPasswordFormValues = z.infer<typeof newPasswordSchema>;

const SetNewPasswordPage = () => {
  const navigate = useNavigate();
  const { session, refetchProfile } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<NewPasswordFormValues>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: {
      newPassword: '',
      confirmNewPassword: '',
    },
  });

  const handleSetNewPassword = async (values: NewPasswordFormValues) => {
    if (!session?.user) {
      showError("Usuário não logado.");
      return;
    }
    setIsSubmitting(true);
    form.clearErrors();

    try {
      // 1. Atualizar a senha do usuário no Supabase Auth
      const { error: updateAuthError } = await supabase.auth.updateUser({ password: values.newPassword });
      if (updateAuthError) {
        throw updateAuthError;
      }

      // 2. Atualizar o campo password_changed no perfil do usuário para true
      const { error: updateProfileError } = await supabase
        .from('profiles')
        .update({ password_changed: true })
        .eq('id', session.user.id);

      if (updateProfileError) {
        // Se houver erro aqui, a senha foi alterada, mas o status não.
        // O usuário pode precisar tentar novamente ou entrar em contato com o suporte.
        console.error("Erro ao atualizar status 'password_changed' no perfil:", updateProfileError);
        showError("Senha atualizada, mas houve um erro ao registrar a mudança. Por favor, entre em contato com o suporte.");
        // Ainda assim, tentamos redirecionar, pois a senha foi alterada.
      }

      showSuccess("Senha definida com sucesso! Bem-vindo(a)!");
      await refetchProfile(); // Atualiza o contexto da sessão com o novo status
      navigate('/today', { replace: true }); // Redireciona para a página principal
    } catch (error: any) {
      showError("Erro ao definir nova senha: " + error.message);
      console.error("Erro ao definir nova senha:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-secondary/40 p-4 text-center">
      <div className="mb-8">
        <Logo />
        <p className="mt-2 text-muted-foreground">Sua jornada de fé começa aqui.</p>
      </div>

      <Card className="w-full max-w-md p-6 space-y-6 animate-fade-in">
        <CardHeader className="p-0 pb-2">
          <Lock className="h-16 w-16 text-primary mx-auto mb-4" />
          <CardTitle className="text-2xl font-bold text-primary">Defina Sua Nova Senha</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <p className="text-muted-foreground mb-4">
            Para sua segurança, por favor, defina uma nova senha para sua conta.
          </p>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSetNewPassword)} className="space-y-4">
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nova Senha</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Sua nova senha" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmNewPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmar Nova Senha</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Confirme sua nova senha" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button 
                type="submit" 
                disabled={isSubmitting || !form.formState.isValid} 
                className="w-full py-6 text-lg"
              >
                {isSubmitting ? <Loader2 className="h-6 w-6 animate-spin mr-2" /> : null}
                Definir Senha e Continuar
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SetNewPasswordPage;