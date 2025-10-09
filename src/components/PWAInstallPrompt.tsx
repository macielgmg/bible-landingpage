"use client";

import React, { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';
import { useSession } from '@/contexts/SessionContext';

export const PWAInstallPrompt = () => {
  const {
    deferredPWAInstallPrompt,
    isPWAInstalled,
    showPWAInstallPrompt,
    setShowPWAInstallPrompt,
    enablePopups,
  } = useSession();

  const handleInstallClick = async () => {
    if (deferredPWAInstallPrompt) {
      // Trigger the browser's install prompt
      deferredPWAInstallPrompt.prompt();
      // Wait for the user to respond to the prompt
      const { outcome } = await (deferredPWAInstallPrompt as any).userChoice;
      console.log(`User response to the install prompt: ${outcome}`);
      
      // The 'appinstalled' event listener in SessionContext will handle setting isPWAInstalled to true
      // and clearing the deferred prompt if the user accepts.
      // If the user dismisses, we still hide the dialog.
      setShowPWAInstallPrompt(false); 
    }
  };

  // Do not render if popups are disabled or PWA is already installed
  if (!enablePopups || isPWAInstalled) {
    return null;
  }

  // The dialog itself is controlled by showPWAInstallPrompt
  return (
    <Dialog open={showPWAInstallPrompt} onOpenChange={setShowPWAInstallPrompt}>
      <DialogContent className="sm:max-w-[425px] p-6 text-center">
        <DialogHeader className="flex flex-col items-center text-center mb-4">
          <Download className="h-12 w-12 text-primary mb-4" />
          <DialogTitle className="text-2xl font-bold text-primary">Instale nosso aplicativo!</DialogTitle>
          <DialogDescription className="text-muted-foreground mt-2">
            {deferredPWAInstallPrompt ? (
              "Para uma experiência ainda melhor, instale o Raízes da Fé diretamente no seu dispositivo. É rápido e gratuito!"
            ) : (
              "Para instalar, use a função 'Adicionar à tela inicial' do menu do seu navegador."
            )}
          </DialogDescription>
        </DialogHeader>
        {deferredPWAInstallPrompt ? ( // Only show install button if prompt is available
          <Button onClick={handleInstallClick} className="w-full">
            <Download className="h-5 w-5 mr-2" /> Instalar Aplicativo
          </Button>
        ) : ( // Show a "Got it" button if no direct install prompt
          <Button onClick={() => setShowPWAInstallPrompt(false)} className="w-full" variant="outline">
            Entendi
          </Button>
        )}
        <Button variant="ghost" size="icon" className="absolute top-4 right-4" onClick={() => setShowPWAInstallPrompt(false)}>
          <X className="h-4 w-4" />
          <span className="sr-only">Fechar</span>
        </Button>
      </DialogContent>
    </Dialog>
  );
};