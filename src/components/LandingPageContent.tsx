"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionContext';
import { cn } from '@/lib/utils';

export const LandingPageContent = () => {
  const navigate = useNavigate();
  const { session } = useSession();

  const staticImageUrl = "https://res.cloudinary.com/djmx0jbus/image/upload/v1757876458/Capa_de_Livro_Biografia_Minimalista_Cinza_e_Vermelho_41_bt6pp2.png";

  const handleGetStarted = () => {
    if (session) {
      navigate('/today');
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Section: Illustration Placeholder */}
      <div className="relative flex-1 flex items-center justify-center p-4 bg-[hsl(var(--landing-top-bg))]">
        <div className="absolute inset-0 flex items-center justify-center">
          <img 
            src={staticImageUrl} 
            alt="Ilustração de capa de livro" 
            className="object-contain max-w-[70%] max-h-[70%] animate-fade-in" // Ajustado max-w e max-h para diminuir a imagem
          />
        </div>
      </div>

      {/* Bottom Section: White Card */}
      <div className="bg-white rounded-t-3xl p-8 pt-12 text-center shadow-lg relative z-10">
        <h1 className="text-4xl font-bold text-foreground mb-4">
          Aprofunde sua jornada de fé
        </h1>
        <p className="text-base text-muted-foreground mb-8">
          Descubra uma vasta seleção de estudos bíblicos e ferramentas de crescimento espiritual.
        </p>
        <Button 
          onClick={handleGetStarted} 
          className="w-full py-6 text-lg bg-foreground text-background hover:bg-foreground/90 rounded-full"
        >
          Começar
        </Button>
      </div>
    </div>
  );
};