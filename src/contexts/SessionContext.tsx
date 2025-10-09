import { supabase } from '@/integrations/supabase/client';
import { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';

interface Announcement {
  id: string;
  title: string;
  content: string;
  emoji: string | null;
  created_at: string;
}

interface SessionContextType {
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  isGabrielSpecialUser: boolean;
  fullName: string | null;
  avatarUrl: string | null;
  hasNewStudyNotification: boolean;
  setNewStudyNotification: (value: boolean) => void;
  refetchProfile: () => Promise<void>;
  onboardingCompleted: boolean;
  quizResponses: string | null;
  preferences: string | null;
  enablePopups: boolean;
  totalShares: number;
  totalJournalEntries: number;
  latestUnseenAnnouncement: Announcement | null;
  markAnnouncementAsSeen: (announcementId: string) => Promise<void>;
  // NOVO: Propriedades para o PWA Install Prompt
  deferredPWAInstallPrompt: Event | null;
  isPWAInstalled: boolean;
  showPWAInstallPrompt: boolean;
  setDeferredPWAInstallPrompt: (event: Event | null) => void;
  setIsPWAInstalled: (installed: boolean) => void;
  setShowPWAInstallPrompt: (show: boolean) => void;
  passwordChanged: boolean; // Adicionado status de mudança de senha
  isAuthorized: boolean; // NOVO: Adicionado status de autorização
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider = ({ children }: { ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isGabrielSpecialUser, setIsGabrielSpecialUser] = useState(false);
  const [fullName, setFullName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [hasNewStudyNotification, setNewStudyNotification] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [quizResponses, setQuizResponses] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<string | null>(null);
  const [enablePopups, setEnablePopups] = useState(true);
  const [totalShares, setTotalShares] = useState(0);
  const [totalJournalEntries, setTotalJournalEntries] = useState(0);
  const [latestUnseenAnnouncement, setLatestUnseenAnnouncement] = useState<Announcement | null>(null);
  // NOVO: Estados para o PWA Install Prompt
  const [deferredPWAInstallPrompt, setDeferredPWAInstallPrompt] = useState<Event | null>(null);
  const [isPWAInstalled, setIsPWAInstalled] = useState(false);
  const [showPWAInstallPrompt, setShowPWAInstallPrompt] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(true); // Estado para passwordChanged, default true
  const [isAuthorized, setIsAuthorized] = useState(false); // NOVO: Estado para isAuthorized

  const fetchProfile = useCallback(async (user: User | null) => {
    if (!user) {
      console.log('fetchProfile: No user, resetting profile states.');
      setIsAdmin(false);
      setIsGabrielSpecialUser(false);
      setFullName(null);
      setAvatarUrl(null);
      setOnboardingCompleted(false);
      setQuizResponses(null);
      setPreferences(null);
      setEnablePopups(true);
      setTotalShares(0);
      setTotalJournalEntries(0);
      setLatestUnseenAnnouncement(null);
      setPasswordChanged(true); // Resetar para true se não houver usuário
      setIsAuthorized(false); // NOVO: Resetar isAuthorized
      return;
    }

    console.log('fetchProfile: Fetching profile for user ID:', user.id);
    console.log('fetchProfile: User email from session:', user.email);
    
    // 1. Verificar se o email do usuário está na tabela authorized_users e buscar password_changed
    const normalizedEmail = user.email?.trim().toLowerCase() || ''; // Normalizar o email da sessão
    console.log('fetchProfile: Normalized email for authorized_users query:', normalizedEmail);

    const { data: authUserEntry, error: authUserEntryError } = await supabase
      .from('authorized_users')
      .select('email, password_changed') // Selecionar password_changed aqui
      .eq('email', normalizedEmail) // Usar o email normalizado na consulta
      .maybeSingle();

    if (authUserEntryError && authUserEntryError.code !== 'PGRST116') {
      console.error('fetchProfile: Error checking authorized_users:', authUserEntryError);
      setIsAuthorized(false);
      await supabase.auth.signOut();
      return;
    }

    if (!authUserEntry) {
      console.log('fetchProfile: User email NOT found in authorized_users for normalized email:', normalizedEmail, '. Signing out.');
      setIsAuthorized(false);
      await supabase.auth.signOut(); // Deslogar usuário não autorizado
      return; // Parar o processamento do perfil para usuário não autorizado
    } else {
      console.log('fetchProfile: User email FOUND in authorized_users for normalized email:', normalizedEmail, '. Entry:', authUserEntry);
      setIsAuthorized(true);
      setPasswordChanged(authUserEntry.password_changed ?? false); // Definir de authorized_users, default para false
      console.log('fetchProfile: Set passwordChanged from authorized_users to:', authUserEntry.password_changed ?? false);
    }

    let profileData = null;
    let profileError = null;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('first_name,last_name,avatar_url,onboarding_completed,quiz_responses,preferences,daily_verse_notifications,study_reminders,achievement_notifications,enable_popups,total_shares,total_journal_entries') // Removido password_changed
        .eq('id', user.id)
        .single();
      profileData = data;
      profileError = error;
    } catch (error: any) {
      profileError = error;
    }

    // If profile not found (PGRST116), create a new one
    if (profileError && profileError.code === 'PGRST116') {
      console.log('fetchProfile: Profile not found, attempting to create a new one.');
      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          first_name: user.user_metadata.first_name || null,
          last_name: user.user_metadata.last_name || null,
          avatar_url: user.user_metadata.avatar_url || null,
          onboarding_completed: false,
          quiz_responses: null,
          preferences: null,
          enable_popups: true,
          total_shares: 0,
          total_journal_entries: 0,
          // Removido password_changed daqui
        })
        .select('*')
        .single();

      if (insertError) {
        console.error('fetchProfile: Error inserting new profile:', insertError);
        profileData = null;
      } else {
        console.log('fetchProfile: New profile created successfully.');
        profileData = newProfile;
        profileError = null;
      }
    } else if (profileError) {
      console.error('fetchProfile: Error fetching profile:', profileError);
    }

    if (profileData) {
      console.log('fetchProfile: Profile data received/processed:', profileData);
      
      setFullName([profileData.first_name, profileData.last_name].filter(Boolean).join(' ') || null);
      setAvatarUrl(profileData.avatar_url || null);
      setOnboardingCompleted(profileData.onboarding_completed ?? false);
      setQuizResponses(profileData.quiz_responses || null);
      setPreferences(profileData.preferences || null);
      setEnablePopups(profileData.enable_popups ?? true);
      setTotalShares(profileData.total_shares ?? 0);
      setTotalJournalEntries(profileData.total_journal_entries ?? 0);
      console.log('fetchProfile: Set onboardingCompleted to:', profileData.onboarding_completed ?? false);
    } else {
      console.log('fetchProfile: Profile data still not available, using user_metadata for name and setting defaults.');
      setFullName(user.user_metadata.first_name || user.user_metadata.last_name ? [user.user_metadata.first_name, user.user_metadata.last_name].filter(Boolean).join(' ') : null);
      setAvatarUrl(user.user_metadata.avatar_url || null);
      setOnboardingCompleted(false);
      setQuizResponses(null);
      setPreferences(null);
      setEnablePopups(true);
      setTotalShares(0);
      setTotalJournalEntries(0);
      // passwordChanged já foi definido de authorized_users
      console.log('fetchProfile: Set onboardingCompleted to false (profile not found).');
    }

    const { data: adminData, error: adminError } = await supabase
      .from('admin_users')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (adminError && adminError.code !== 'PGRST116') {
      console.error('fetchProfile: Error fetching admin status:', adminError);
      setIsAdmin(false);
    } else {
      setIsAdmin(!!adminData);
    }
    setIsGabrielSpecialUser(user.email === 'gabrielgmg280@gmail.com');
    console.log('fetchProfile: User is admin:', !!adminData, 'User is Gabriel special:', user.email === 'gabrielgmg280@gmail.com');

  }, []);

  const fetchUnseenAnnouncements = useCallback(async (userId: string) => {
    if (!userId) {
      setLatestUnseenAnnouncement(null);
      return;
    }

    const { data: seenAnnouncementsData, error: seenError } = await supabase
      .from('user_announcements_seen')
      .select('announcement_id')
      .eq('user_id', userId);

    if (seenError) {
      console.error('Error fetching seen announcements:', seenError);
      setLatestUnseenAnnouncement(null);
      return;
    }

    const seenIds = seenAnnouncementsData ? seenAnnouncementsData.map(item => item.announcement_id) : [];
    console.log('fetchUnseenAnnouncements: seenIds:', seenIds);

    let query = supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    if (seenIds.length > 0) {
      const idsString = seenIds.map(id => `'${id}'`).join(',');
      query = query.filter('id', 'not.in', `(${idsString})`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching unseen announcements:', error);
      setLatestUnseenAnnouncement(null);
      return;
    }

    if (data && data.length > 0) {
      setLatestUnseenAnnouncement(data[0] as Announcement);
    } else {
      setLatestUnseenAnnouncement(null);
    }
  }, []);

  const markAnnouncementAsSeen = useCallback(async (announcementId: string) => {
    if (!session?.user?.id) return;

    const { error } = await supabase
      .from('user_announcements_seen')
      .insert({
        user_id: session.user.id,
        announcement_id: announcementId,
      });

    if (error) {
      console.error('Error marking announcement as seen:', error);
    } else {
      await fetchUnseenAnnouncements(session.user.id);
    }
  }, [session, fetchUnseenAnnouncements]);

  const refetchProfile = useCallback(async () => {
    if (session?.user) {
      console.log('refetchProfile: Manually refetching profile for user ID:', session.user.id);
      await fetchProfile(session.user);
      await fetchUnseenAnnouncements(session.user.id);
    }
  }, [session, fetchProfile, fetchUnseenAnnouncements]);

  useEffect(() => {
    let isMounted = true;

    const getSessionAndSetState = async () => {
      if (!isMounted) return;
      setLoading(true);
      console.log('useEffect[initial/visibility]: Attempting to get session.');
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (isMounted) {
          setSession(currentSession);
          console.log('useEffect[initial/visibility]: Session set:', currentSession ? 'present' : 'null');
        }
      } catch (error) {
        console.error("useEffect[initial/visibility]: Error getting initial session:", error);
        if (isMounted) setSession(null);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault(); // Prevent the default browser prompt
      if (isMounted) {
        setDeferredPWAInstallPrompt(event);
        console.log('beforeinstallprompt event captured.');
      }
    };

    const handleAppInstalled = () => {
      if (isMounted) {
        setIsPWAInstalled(true);
        setDeferredPWAInstallPrompt(null); // Clear the deferred prompt once installed
        setShowPWAInstallPrompt(false); // Hide any active prompt
        console.log('PWA installed successfully!');
      }
    };

    // Check if already installed on load
    if (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone) {
      setIsPWAInstalled(true);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    getSessionAndSetState();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isMounted) {
        console.log('useEffect[initial/visibility]: Page visible, re-getting session.');
        getSessionAndSetState();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    console.log('useEffect[onAuthStateChange]: Setting up auth state listener.');
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (isMounted) {
        setSession(newSession);
        console.log('useEffect[onAuthStateChange]: Auth state changed, new session set:', newSession ? 'present' : 'null', 'Event:', _event);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      console.log('useEffect[onAuthStateChange]: Auth state listener unsubscribed.');
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const updateProfileAndLoading = async () => {
      if (!isMounted) return;
      setLoading(true);
      console.log('useEffect[session]: Session changed, updating profile and loading state. Current session:', session ? 'present' : 'null');
      try {
        await fetchProfile(session?.user ?? null);
        if (session?.user) {
          await fetchUnseenAnnouncements(session.user.id);
        }
      } catch (error) {
        console.error("useEffect[session]: Error updating profile after session change:", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    updateProfileAndLoading();
  }, [session, fetchProfile, fetchUnseenAnnouncements]);

  return (
    <SessionContext.Provider value={{ 
      session, 
      loading, 
      isAdmin,
      isGabrielSpecialUser,
      fullName, 
      avatarUrl, 
      hasNewStudyNotification, 
      setNewStudyNotification, 
      refetchProfile,
      onboardingCompleted,
      quizResponses,
      preferences,
      enablePopups,
      totalShares,
      totalJournalEntries,
      latestUnseenAnnouncement,
      markAnnouncementAsSeen,
      // NOVO: Valores para o PWA Install Prompt
      deferredPWAInstallPrompt,
      isPWAInstalled,
      showPWAInstallPrompt,
      setDeferredPWAInstallPrompt,
      setIsPWAInstalled,
      setShowPWAInstallPrompt,
      passwordChanged,
      isAuthorized, // NOVO: Adicionado isAuthorized ao contexto
    }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};