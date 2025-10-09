"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Star } from 'lucide-react'; // Importar Star icon
import { cn } from '@/lib/utils'; // Importar cn para combinar classes

export const WelcomeScreen = ({ onContinue }: { onContinue: () => void }) => {
  const navigate = useNavigate();

  const staticImageUrl = "https://res.cloudinary.com/djmx0jbus/image/upload/v1757875476/Capa_de_Livro_Biografia_Minimalista_Cinza_e_Vermelho_39_asbvhp.png";

  const handleContinue = () => {
    onContinue();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-secondary/40 p-4 text-center animate-fade-in">
      <div className="relative mb-8 w-full max-w-xs aspect-square flex items-center justify-center">
        <img 
          src={staticImageUrl} 
          alt="Ilustração de capa de livro" 
          className="object-contain w-full h-full animate-fade-in-up animation-delay-100" 
        />
      </div>
      <h1 className="text-4xl font-bold text-primary mb-4 animate-fade-in-up animation-delay-200">
        De cristãos, para cristãos
      </h1>
      <p className="text-lg text-muted-foreground max-w-md mb-8 animate-fade-in-up animation-delay-300">
        Nossa missão é fortalecer sua fé e aprofundar seu conhecimento da Palavra.
      </p>

      {/* Nova seção de prova social (ratings) */}
      <div className="flex items-center justify-center gap-1 mb-8 animate-fade-in-up animation-delay-400">
        {[...Array(5)].map((_, i) => (
          <Star key={i} className="h-6 w-6 text-yellow-500 fill-yellow-500" />
        ))}
        <p className="text-sm text-muted-foreground ml-2 font-semibold">
          Mais de 10 mil avaliações 5 estrelas!
        </p>
      </div>

      <Button 
        onClick={handleContinue} 
        size="lg" 
        className="px-8 py-6 text-lg animate-pulse-slow"
      >
        Continuar
      </Button>
    </div>
  );
};