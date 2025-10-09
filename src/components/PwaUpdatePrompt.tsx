"use client";

import React, { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner'; // Removido 'Toast' da importação
import { RefreshCw, Download } from 'lucide-react';
import { useSession } from '@/contexts/SessionContext'; // Importar useSession

export const PwaUpdatePrompt = () => {
  const { enablePopups } = useSession(); // Obter a preferência de pop-ups
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);

  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      // console.log('SW Registered: ', r);
    },
    onRegisterError(error) {
      console.error('SW registration error', error);
    },
    onNeedRefresh() {
      // console.log('New content available, please refresh.');
      if (enablePopups) { // Só mostra o prompt se os pop-ups estiverem habilitados
        setShowUpdatePrompt(true);
      }
    },
    onOfflineReady() {
      // console.log('App is ready to work offline.');
      // Removido: toast.success('O aplicativo está pronto para uso offline!', {
      // Removido:   icon: <Download className="h-5 w-5" />,
      // Removido:   duration: 3000,
      // Removido: });
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
    setShowUpdatePrompt(false);
  };

  const handleUpdate = () => {
    updateServiceWorker(true);
    close();
  };

  useEffect(() => {
    if (needRefresh && enablePopups) {
      toast.custom((t: string | number) => ( // Tipado 't' como string | number
        <div className="flex items-center gap-4 p-4 rounded-lg shadow-lg bg-card border border-primary/20 w-full max-w-sm">
          <RefreshCw className="h-8 w-8 text-primary" />
          <div>
            <p className="font-bold text-primary">Nova Atualização Disponível!</p>
            <p className="text-sm text-muted-foreground">Uma nova versão do aplicativo está pronta.</p>
            <div className="flex gap-2 mt-3">
              <Button variant="default" size="sm" onClick={handleUpdate}>
                Atualizar Agora
              </Button>
              <Button variant="outline" size="sm" onClick={() => toast.dismiss(t)}>
                Mais Tarde
              </Button>
            </div>
          </div>
        </div>
      ), { id: 'pwa-update-prompt', duration: Infinity }); // Duração infinita para o usuário decidir
    } else if (!needRefresh) {
      toast.dismiss('pwa-update-prompt'); // Remove o toast se não precisar mais de refresh
    }
  }, [needRefresh, enablePopups, updateServiceWorker]);

  return null; // Este componente não renderiza nada diretamente, ele gerencia toasts
};