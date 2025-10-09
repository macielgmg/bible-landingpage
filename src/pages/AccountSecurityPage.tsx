import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Lock, Loader2, Mail, KeyRound } from 'lucide-react';
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
import { cn } from '@/lib/utils'; // Importar cn para combinar classes

// Esquema de validação para mudança de senha
const passwordSchema = z.object({
  newPassword: z.string().min(6, "A nova senha deve ter pelo menos 6 caracteres."),
  confirmNewPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: "As senhas não coincidem.",
  path: ["confirmNewPassword"],
});

type PasswordFormValues = z.infer<typeof passwordSchema>;

const AccountSecurityPage = () => {
  const navigate = useNavigate();
  const { session } = useSession();
  // Removido: isUpdatingEmail e setNewEmail, pois a edição de email será desabilitada
  const [showPasswordForm, setShowPasswordForm] = useState(false); // NOVO: Estado para controlar a visibilidade do formulário de senha

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      newPassword: '',
      confirmNewPassword: '',
    },
  });

  // Removido: handleUpdateEmail, pois a edição de email será desabilitada

  const handleUpdatePassword = async (values: PasswordFormValues) => {
    if (!session?.user) {
      showError("Usuário não logado.");
      return;
    }
    passwordForm.clearErrors(); // Limpa erros anteriores
    try {
      const { error } = await supabase.auth.updateUser({ password: values.newPassword });
      if (error) {
        throw error;
      }
      showSuccess("Senha atualizada com sucesso!");
      passwordForm.reset(); // Limpa o formulário
      setShowPasswordForm(false); // Oculta o formulário após o sucesso
    } catch (error: any) {
      showError("Erro ao atualizar senha: " + error.message);
      console.error("Erro ao atualizar senha:", error);
    }
  };

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
        <h1 className="text-xl font-bold text-primary">Segurança da Conta</h1>
      </header>

      <div className="space-y-6">
        {/* Alterar Email (apenas visualização) */}
        <Card className="p-6 space-y-4">
          <CardHeader className="p-0 pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" /> Email da Conta
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 space-y-4">
            <div>
              <Label htmlFor="current-email">Seu Email</Label>
              <Input
                id="current-email"
                type="email"
                value={session?.user?.email || ''}
                readOnly // Apenas leitura
                className="mt-1 bg-muted cursor-not-allowed"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Para alterar seu email, por favor, entre em contato com o suporte.
            </p>
            {/* Removido: Botão de Atualizar Email */}
          </CardContent>
        </Card>

        {/* Alterar Senha */}
        <Card className="p-6 space-y-4">
          <CardHeader className="p-0 pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" /> Alterar Senha
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!showPasswordForm ? (
              <Button 
                onClick={() => setShowPasswordForm(true)} 
                className="w-full"
              >
                Clique para alterar a senha
              </Button>
            ) : (
              <Form {...passwordForm}>
                <form onSubmit={passwordForm.handleSubmit(handleUpdatePassword)} className="space-y-4 animate-fade-in">
                  <FormField
                    control={passwordForm.control}
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
                    control={passwordForm.control}
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
                  <div className="flex gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => {
                        passwordForm.reset(); // Limpa o formulário
                        setShowPasswordForm(false); // Oculta o formulário
                      }}
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={passwordForm.formState.isSubmitting || !passwordForm.formState.isValid} 
                      className="flex-1"
                    >
                      {passwordForm.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Atualizar Senha
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AccountSecurityPage;