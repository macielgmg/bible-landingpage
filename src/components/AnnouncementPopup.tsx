"use client";

import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useSession } from '@/contexts/SessionContext';
import { Megaphone, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Announcement {
  id: string;
  title: string;
  content: string;
  emoji: string | null;
  created_at: string;
}

export const AnnouncementPopup = () => {
  const { session, loading, enablePopups, latestUnseenAnnouncement, markAnnouncementAsSeen } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [currentAnnouncement, setCurrentAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    if (!loading && session && enablePopups && latestUnseenAnnouncement) {
      setCurrentAnnouncement(latestUnseenAnnouncement);
      setIsOpen(true);
    } else if (!latestUnseenAnnouncement) {
      setIsOpen(false);
      setCurrentAnnouncement(null);
    }
  }, [loading, session, enablePopups, latestUnseenAnnouncement]);

  const handleClose = async () => {
    if (currentAnnouncement) {
      await markAnnouncementAsSeen(currentAnnouncement.id);
    }
    setIsOpen(false);
    setCurrentAnnouncement(null);
  };

  if (!currentAnnouncement || !enablePopups) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px] p-6">
        <DialogHeader className="flex flex-col items-center text-center mb-4">
          <div className="p-3 rounded-full bg-primary/10 text-primary mb-4">
            {currentAnnouncement.emoji ? (
              <span className="text-3xl">{currentAnnouncement.emoji}</span>
            ) : (
              <Megaphone className="h-8 w-8" />
            )}
          </div>
          <DialogTitle className="text-2xl font-bold text-primary">{currentAnnouncement.title}</DialogTitle>
          <DialogDescription className="text-muted-foreground mt-2">
            {currentAnnouncement.content}
          </DialogDescription>
        </DialogHeader>
        <Button onClick={handleClose} className="w-full">
          Entendi!
        </Button>
        <Button variant="ghost" size="icon" className="absolute top-4 right-4" onClick={handleClose}>
          <X className="h-4 w-4" />
          <span className="sr-only">Fechar</span>
        </Button>
      </DialogContent>
    </Dialog>
  );
};