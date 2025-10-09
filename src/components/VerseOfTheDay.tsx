"use client";

import { Quote, Loader2, BookOpen, Share2 } from "lucide-react"; // Adicionado Share2
import { cn } from "@/lib/utils";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Adicionado: Importação do Card
import { useNavigate } from 'react-router-dom'; // Importar useNavigate

interface VerseOfTheDayProps {
  verseContent: { text: string; reference: string; explanation: string | null } | null;
  loading: boolean;
  className?: string;
}

export const VerseOfTheDay = ({ verseContent, loading, className }: VerseOfTheDayProps) => {
  const navigate = useNavigate();

  const handleShare = () => {
    if (!verseContent) {
      // Ideally, this button would be disabled if no content, but for safety:
      console.error("No verse content to share.");
      return;
    }
    navigate('/share-creator', {
      state: {
        shareContent: {
          text: verseContent.text,
          reference: verseContent.reference,
          explanation: verseContent.explanation,
        }
      }
    });
  };

  if (loading) {
    return (
      <Card className={cn("bg-gradient-to-br from-primary/90 to-primary text-primary-foreground h-32 flex flex-col items-center justify-center", className)}>
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary-foreground border-t-transparent"></div>
      </Card>
    );
  }

  if (!verseContent) {
    return (
      <Card className={cn("bg-gradient-to-br from-primary/90 to-primary text-primary-foreground h-32 flex flex-col items-center justify-center text-center p-4", className)}>
        <p className="text-lg font-semibold">Nenhum versículo disponível.</p>
        <p className="text-sm opacity-80">Tente novamente mais tarde.</p>
      </Card>
    );
  }

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Card className={cn("bg-gradient-to-br from-primary/90 to-primary text-primary-foreground h-32 flex flex-col cursor-pointer", className)}>
          <CardHeader className="py-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Quote className="h-5 w-5" />
              Versículo do Dia
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-grow flex flex-col justify-center items-center text-center py-2 px-4">
            <p className="text-lg font-serif italic line-clamp-2 leading-tight">
              "{verseContent.text}" <span className="font-semibold text-sm not-italic">{verseContent.reference}</span>
            </p>
          </CardContent>
        </Card>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-md text-center">
          <DrawerHeader>
            <div className="flex flex-col items-center justify-center p-4">
              <BookOpen className="h-12 w-12 text-primary mb-4" />
              <DrawerTitle className="text-2xl text-primary">{verseContent.reference}</DrawerTitle>
              <DrawerDescription className="mt-2 text-lg font-serif italic leading-relaxed">
                "{verseContent.text}"
              </DrawerDescription>
            </div>
          </DrawerHeader>
          <div className="p-4 text-left space-y-4">
            <h3 className="text-xl font-bold text-primary">Explicação</h3>
            <p className="text-muted-foreground leading-relaxed">
              {verseContent.explanation || "Nenhuma explicação disponível para este versículo."}
            </p>
          </div>
          <DrawerFooter>
            <Button 
              variant="outline" 
              onClick={handleShare} 
              className="w-full mb-2" // Adicionado mb-2 para espaçamento
              disabled={!verseContent}
            >
              <Share2 className="h-4 w-4 mr-2" /> Compartilhar Versículo
            </Button>
            <DrawerClose asChild>
              <Button variant="outline">Fechar</Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
};