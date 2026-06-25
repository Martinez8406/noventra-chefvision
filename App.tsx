
import React, { useState, useEffect } from 'react';
import { Dish, DishStatus, GeneratorParams, UserProfile, Backdrop, RecommendationCurrency } from './types';
import { ChefsStudio } from './components/ChefsStudio';
import { SeasonalThemes } from './components/SeasonalThemes';
import { BackdropLab } from './components/BackdropLab';
import { PublicMenu } from './components/PublicMenu';
import { MenuStatsPanel } from './components/MenuStatsPanel';
import { SettingsPanel, type SettingsSection } from './components/SettingsPanel';
import { KitchenWall } from './components/KitchenWall';
import { MenuManager } from './components/MenuManager';
import { HotelHubManager } from './components/HotelHubManager';
import { PromotionsManager } from './components/PromotionsManager';
import { DishDetailPanel } from './components/DishDetailPanel';
import { Auth } from './components/Auth';
import { SuccessPage } from './components/SuccessPage';
import { FreePlanUpgradeCard } from './components/FreePlanUpgradeCard';
import { TrialPlanUpgradeCard } from './components/TrialPlanUpgradeCard';
import { AppLanguageSwitcher } from './components/AppLanguageSwitcher';
import { PremiumUpsellModal } from './components/PremiumUpsellModal';
import { PricingPage, type PricingPlanType } from './components/PricingPage';
import { StartPlanPromoBar } from './components/StartPlanPromoBar';
import { BRAND_LOGO_SRC, TRIAL_TOKENS } from './constants';
import { useTranslation } from 'react-i18next';
import { hasProFeatures, canUseHotelHub } from './utils/tokens';
import { formatTokenStatusI18n, formatPremiumTokenShort } from './utils/formatTokenStatusI18n';
import { resolveRecommendationCurrency } from './utils/recommendationCurrency';
import { supabase, db, authService, uploadDishImage } from './services/supabaseService';
import { hotelHubDb } from './services/hotelHubService';
import { requestMenuTranslations } from './services/aiService';
import { shouldRequestMenuTranslation } from './utils/menuTranslations';
import { createCheckoutSession, confirmPremiumSession } from './services/stripeService';
import { 
  LayoutDashboard, 
  BookOpen, 
  User as UserIcon, 
  LogOut, 
  Menu as MenuIcon, 
  Zap,
  Camera,
  Crown,
  Layers,
  Sparkles,
  Loader2,
  CheckCircle,
  BarChart3,
  Megaphone,
  Lock,
  Settings,
  ChevronDown,
  ChevronRight,
  Building2
} from 'lucide-react';

type AppTab =
  | 'kuchnia'
  | 'studio'
  | 'themes'
  | 'backdrops'
  | 'menu'
  | 'hotel-hub'
  | 'stats'
  | 'promotions'
  | 'settings-qr'
  | 'settings-branding'
  | 'settings-google'
  | 'settings-feedback'
  | 'settings-subscription';

const SETTINGS_SUB_NAV: { id: AppTab; labelKey: string }[] = [
  { id: 'settings-qr', labelKey: 'settingsQr' },
  { id: 'settings-branding', labelKey: 'settingsBranding' },
  { id: 'settings-google', labelKey: 'settingsGoogle' },
  { id: 'settings-feedback', labelKey: 'settingsFeedback' },
  { id: 'settings-subscription', labelKey: 'settingsSubscription' },
];

const NAV_ITEM_DEFS: {
  id: AppTab;
  labelKey: string;
  icon: typeof LayoutDashboard;
  premiumLocked?: boolean;
}[] = [
  { id: 'kuchnia', labelKey: 'kuchnia', icon: LayoutDashboard },
  { id: 'studio', labelKey: 'studio', icon: Camera },
  { id: 'themes', labelKey: 'themes', icon: Sparkles, premiumLocked: true },
  { id: 'backdrops', labelKey: 'backdrops', icon: Layers, premiumLocked: true },
  { id: 'menu', labelKey: 'menu', icon: BookOpen },
  { id: 'hotel-hub', labelKey: 'hotelHub', icon: Building2, premiumLocked: true },
  { id: 'stats', labelKey: 'stats', icon: BarChart3 },
  { id: 'promotions', labelKey: 'promotions', icon: Megaphone, premiumLocked: true },
];

function settingsSectionFromTab(tab: AppTab): SettingsSection | null {
  if (tab === 'settings-qr') return 'qr';
  if (tab === 'settings-branding') return 'branding';
  if (tab === 'settings-google') return 'google';
  if (tab === 'settings-feedback') return 'feedback';
  if (tab === 'settings-subscription') return 'subscription';
  return null;
}

function isSettingsTab(tab: AppTab): boolean {
  return settingsSectionFromTab(tab) !== null;
}

const App: React.FC = () => {
  const safeDecodeRouteParam = (value: string | undefined): string | null => {
    if (!value) return null;
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };

  const [session, setSession] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [activeTab, setActiveTab] = useState<AppTab>('kuchnia');
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [premiumUpsellOpen, setPremiumUpsellOpen] = useState(false);
  const [selectedDishId, setSelectedDishId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [hash, setHash] = useState(window.location.hash);
  const [pathname, setPathname] = useState(window.location.pathname);
  const [savedBackdrops, setSavedBackdrops] = useState<Backdrop[]>([]);
  const [statusToast, setStatusToast] = useState<string | null>(null);
  const [publicHasWatermark, setPublicHasWatermark] = useState<boolean>(false);
  const [publicMenuLoading, setPublicMenuLoading] = useState(false);
  const [startPromoBarVisible, setStartPromoBarVisible] = useState(false);
  const { t: tNav } = useTranslation('nav');
  const { t: tSidebar } = useTranslation('sidebar');
  const { t: tKitchen } = useTranslation('kitchen');
  const { t: tStudio } = useTranslation('studio');
  const { t: tMenu } = useTranslation('menu');
  const { t: tThemes } = useTranslation('themes');
  const { t: tPromotions } = useTranslation('promotions');
  const { t: tHotelHub } = useTranslation('hotelHub');
  
  useEffect(() => {
    let subscription: any = null;
    let initialised = false;

    const markInitialised = (session: any) => {
      setSession(session);
      if (!initialised) {
        initialised = true;
        setIsSyncing(false);
      }
    };

    if (supabase) {
      // Listen first so we catch the PKCE code-exchange session right away.
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        markInitialised(session);
      });
      subscription = data.subscription;

      // Also call getSession — in PKCE flow this triggers the ?code= exchange
      // and resolves to the real session before onAuthStateChange fires.
      supabase.auth.getSession().then(({ data: { session } }) => {
        markInitialised(session);
      });
    } else {
      setIsSyncing(false);
    }

    const handleHashChange = () => setHash(window.location.hash);
    const handlePopState = () => {
      setHash(window.location.hash);
      setPathname(window.location.pathname);
    };
    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handlePopState);
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const isPublic = hash.includes('#/') || pathname.startsWith('/menu/');
    if (session || isPublic) {
      syncData();
    }
  }, [session, hash, pathname]);

  const syncData = async () => {
    // Nie ustawiamy isSyncing=true przy ponownych odświeżeniach (np. po token refresh),
    // żeby nie odmontowywać ChefsStudio i nie resetować stanu formularza.
    if (isInitialLoad) setIsSyncing(true);
    let loadingPublicMenu = false;
    try {
      const hashMatch = hash.match(/#\/menu\/([^/?#]+)(?:\/hub(?:\/([^/?#]+))?(?:\/dish\/([^/?#]+))?)?/);
      const pathMatch = pathname.match(/^\/menu\/([^/]+)(?:\/hub(?:\/([^/]+))?(?:\/dish\/([^/]+))?)?\/?$/);
      const publicMenuUserId =
        safeDecodeRouteParam(hashMatch?.[1]) ?? safeDecodeRouteParam(pathMatch?.[1]);
      if (publicMenuUserId) {
        loadingPublicMenu = true;
        setPublicMenuLoading(true);
        setDishes([]);
        const ownerProfile = await authService.getProfileById(publicMenuUserId);
        if (ownerProfile) {
          setPublicHasWatermark(ownerProfile.subscriptionStatus === 'free_limited');
        } else {
          // Domyślnie traktuj jako wersję darmową – lepiej pokazać znak wodny niż go pominąć
          setPublicHasWatermark(true);
        }
        const data = await db.getDishesForPublicMenu(publicMenuUserId);
        setDishes(data);
        setSavedBackdrops([]);
      } else {
        setPublicMenuLoading(false);
        if (session?.user?.id === 'demo') {
          const demoProfile: UserProfile = {
            id: 'local-chef',
            name: 'Restauracja Testowa',
            email: 'demo@chefvision.pl',
            subscriptionStatus: 'trial',
            generationsUsed: parseInt(typeof window !== 'undefined' ? localStorage.getItem('chefvision_user_gens') || '0' : '0'),
            credits: Math.max(0, TRIAL_TOKENS - parseInt(typeof window !== 'undefined' ? localStorage.getItem('chefvision_user_gens') || '0' : '0')),
          };
          setCurrentUser(demoProfile);
          const data = await db.getDishes('local-chef');
          setDishes(data);
          try {
            setSavedBackdrops(await db.getBackdrops('local-chef'));
          } catch (e) {
            console.warn('Tła (demo):', e);
            setSavedBackdrops([]);
          }
        } else {
          let profile = await authService.getCurrentProfile();
          if (!profile && session?.user) {
            profile = {
              id: session.user.id,
              name: session.user.email?.split('@')[0] || 'Restauracja',
              email: session.user.email || '',
              subscriptionStatus: 'trial',
              generationsUsed: 0,
              credits: TRIAL_TOKENS,
            };
          }
          setCurrentUser(profile);
          const restaurantId = profile ? profile.id : 'local-chef';
          const data = await db.getDishes(restaurantId);
          setDishes(data);
          try {
            setSavedBackdrops(await db.getBackdrops(restaurantId));
          } catch (e) {
            console.warn('Tła: nie zsynchronizowano (dodaj tabelę user_backdrops w Supabase — plik supabase/user_backdrops.sql):', e);
            setSavedBackdrops([]);
          }
        }
      }
    } catch (e) { 
      console.error("Błąd synchronizacji:", e); 
    } finally { 
      setIsSyncing(false);
      setIsInitialLoad(false);
      if (loadingPublicMenu) setPublicMenuLoading(false);
    }
  };

  const isPremium = currentUser?.subscriptionStatus === 'premium';
  const isTrial = currentUser?.subscriptionStatus === 'trial';
  const isStart = currentUser?.subscriptionStatus === 'start';
  const isFree = currentUser?.subscriptionStatus === 'free_limited';
  const hasProAccess = hasProFeatures(currentUser?.subscriptionStatus);
  const hasHotelHubAccess = canUseHotelHub(
    currentUser
      ? {
          plan: currentUser.plan,
          subscription_status: currentUser.subscriptionStatus,
          trial_ends_at: currentUser.trialEndsAt ?? null,
        }
      : null,
  );
  const openPremiumUpsell = () => setPremiumUpsellOpen(true);
  const openPricingPage = () => {
    window.location.hash = '#/cennik';
    setHash('#/cennik');
  };

  const handleSaveBackdrop = async (imageUrl: string) => {
    const uid = session?.user?.id === 'demo' ? 'local-chef' : currentUser?.id;
    if (!uid) {
      alert('Zaloguj się, aby zapisywać tła.');
      return;
    }
    try {
      const list = await db.saveBackdrop(uid, imageUrl);
      setSavedBackdrops(list);
      setStatusToast('Tło zapisane (max 5 — dostępne po każdym zalogowaniu).');
      setTimeout(() => setStatusToast(null), 5000);
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Nie udało się zapisać tła.');
    }
  };

  const hashMatch = hash.match(/#\/menu\/([^/?#]+)(?:\/hub(?:\/([^/?#]+))?(?:\/dish\/([^/?#]+))?)?/);
  const pathMatch = pathname.match(/^\/menu\/([^/]+)(?:\/hub(?:\/([^/]+))?(?:\/dish\/([^/]+))?)?\/?$/);
  const publicMenuUserId =
    safeDecodeRouteParam(hashMatch?.[1]) ?? safeDecodeRouteParam(pathMatch?.[1]);
  const publicHubSectionId =
    safeDecodeRouteParam(hashMatch?.[2]) ?? safeDecodeRouteParam(pathMatch?.[2]);
  const publicDishId =
    safeDecodeRouteParam(hashMatch?.[3]) ?? safeDecodeRouteParam(pathMatch?.[3]);
  const isPublicMenu = !!publicMenuUserId;
  const publicMenuMode: 'restaurant' | 'hub' =
    pathname.includes('/hub') || hash.includes('/hub') ? 'hub' : 'restaurant';
  const isSuccessPage = hash.includes('#/success');
  const isPricingPage = hash.includes('#/cennik') || pathname === '/cennik';

  const refreshCurrentProfile = async () => {
    const profile = await authService.getCurrentProfile();
    if (profile) setCurrentUser(profile);
  };

  const handleCreditsUpdated = (
    creditsRemaining?: number,
    tokens?: { trial: number; subscription: number; extra: number; total: number }
  ) => {
    if (creditsRemaining === undefined || !currentUser) {
      void refreshCurrentProfile();
      return;
    }
    setCurrentUser({
      ...currentUser,
      credits: creditsRemaining,
      tokens: tokens ?? {
        trial: currentUser.subscriptionStatus === 'trial' ? creditsRemaining : 0,
        subscription: currentUser.tokens?.subscription ?? 0,
        extra: currentUser.tokens?.extra ?? 0,
        total: creditsRemaining,
      },
    });
    void refreshCurrentProfile();
  };

  const handleGenerationSuccess = async () => {
    if (!currentUser) return;
    await authService.incrementGenerations(currentUser.id);
    await refreshCurrentProfile();
  };

  const handleSaveStandard = async (imageUrl: string, params: GeneratorParams) => {
    if (!currentUser) return;
    setIsSyncing(true);
    try {
      let finalImageUrl = imageUrl;
      if (imageUrl.startsWith('data:') && supabase) {
        finalImageUrl = await uploadDishImage(imageUrl, currentUser.id);
      }
      const newDish: Partial<Dish> = {
        name: params.dishName,
        imageUrl: finalImageUrl,
        description: tKitchen('dishPanel.descriptionPlaceholder'),
        technique: '',
        ingredients: [],
        allergens: [],
        dietaryTags: [],
        spiceLevel: null,
        isStandard: false,
        isOnline: false,
        status: DishStatus.PENDING,
        createdAt: Date.now(),
        clicks: 0,
      };
      const saved = await db.saveDish(newDish);
      if (saved) {
        setDishes(prev => [saved, ...prev]);
        setSelectedDishId(saved.id);
        setActiveTab('kuchnia');
      }
    } catch (e) {
      console.error('Zapisywanie dania:', e);
      const msg = e instanceof Error ? e.message : tKitchen('errors.saveFailed');
      if (msg.includes('QuotaExceeded') || msg.includes('quota')) {
        alert(tKitchen('errors.quotaExceeded'));
      } else {
        alert(msg);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateDish = async (updatedDish: Dish) => {
    setIsSyncing(true);
    try {
      const saved = await db.saveDish(updatedDish);
      if (saved) {
        setDishes((prev) => prev.map((d) => (d.id === saved.id ? saved : d)));
        setSelectedDishId(null);
        if (
          supabase &&
          shouldRequestMenuTranslation(
            saved,
            currentUser
              ? {
                  subscription_status: currentUser.subscriptionStatus,
                  plan: currentUser.plan,
                  trial_ends_at: currentUser.trialEndsAt ?? null,
                }
              : null
          )
        ) {
          void requestMenuTranslations(saved.id).then((patch) => {
            if (patch?.translations) {
              setDishes((prev) =>
                prev.map((d) =>
                  d.id === saved.id ? { ...d, translations: patch.translations } : d
                )
              );
            }
          });
        }
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleApprove = async (id: string) => {
    const success = await db.updateDishStatus(id, DishStatus.APPROVED);
    if (success) {
      setDishes(prev => prev.map(d => d.id === id ? { ...d, status: DishStatus.APPROVED, isStandard: true } : d));
    }
  };

  const toggleStatus = async (id: string) => {
    const dish = dishes.find(d => d.id === id);
    if (!dish) return;
    const success = await db.toggleDishOnline(id, !dish.isOnline);
    if (success) {
      setDishes(prev => prev.map(d => d.id === id ? { ...d, isOnline: !d.isOnline } : d));
      setStatusToast(tMenu('toasts.dishStatusUpdated'));
      setTimeout(() => setStatusToast(null), 3000);
    }
  };

  const toggleHotelHubVisibility = async (id: string) => {
    if (!hasHotelHubAccess) {
      openPricingPage();
      return;
    }
    const dish = dishes.find((d) => d.id === id);
    if (!dish) return;
    const next = !dish.visibleInHotelHub;
    const success = await db.toggleDishHotelHubVisibility(id, next);
    if (success) {
      setDishes((prev) => prev.map((d) => (d.id === id ? { ...d, visibleInHotelHub: next } : d)));
      setStatusToast(tMenu('toasts.hotelHubVisibilityUpdated'));
      setTimeout(() => setStatusToast(null), 3000);
    }
  };

  const handleUpdateHubAssignments = async (
    dishId: string,
    assignments: Array<{ sectionId: string; categoryId: string }>,
  ) => {
    if (!hasHotelHubAccess) {
      openPricingPage();
      return;
    }
    const uid = session?.user?.id === 'demo' ? 'local-chef' : currentUser?.id;
    if (!uid) return;
    const ok = await hotelHubDb.setDishAssignments(uid, dishId, assignments);
    if (!ok) {
      alert(tHotelHub('errors.assignmentSaveFailed'));
      return;
    }

    const dish = dishes.find((d) => d.id === dishId);
    if (assignments.length > 0 && !dish?.visibleInHotelHub) {
      const visOk = await db.toggleDishHotelHubVisibility(dishId, true);
      if (visOk) {
        setDishes((prev) =>
          prev.map((d) => (d.id === dishId ? { ...d, visibleInHotelHub: true } : d)),
        );
      }
    }

    setStatusToast(tMenu('toasts.hotelHubAssignmentSaved'));
    setTimeout(() => setStatusToast(null), 3000);
  };

  const handleDeleteDish = async (id: string) => {
    const dish = dishes.find(d => d.id === id);
    if (!dish) return;
    const ok = await db.deleteDishWithImage(dish);
    if (ok) {
      setDishes(prev => prev.filter(d => d.id !== id));
    } else {
      alert(tKitchen('errors.deleteFailed'));
    }
  };

  const handleUpdateSocialLink = async (id: string, url: string) => {
    setDishes(prev => prev.map(d => d.id === id ? { ...d, videoUrl: url } : d));
    const ok = await db.updateDishSocialLink(id, url);
    if (!ok) console.error('Aktualizacja Social Link nie powiodła się');
  };

  const handleUpdateDishMenuPrice = async (
    id: string,
    price: string,
    currency: RecommendationCurrency,
  ) => {
    const normalized = price.replace(/[^\d.,]/g, '').trim();
    const menuPriceCurrency = resolveRecommendationCurrency(currency);
    setDishes((prev) =>
      prev.map((d) =>
        d.id === id
          ? { ...d, menuPrice: normalized || null, menuPriceCurrency }
          : d,
      ),
    );
    const ok = await db.updateDishMenuPrice(id, normalized || null, menuPriceCurrency);
    if (!ok) {
      console.error('Aktualizacja ceny dania nie powiodła się');
    }
  };

  const handleUpdateDishCategory = async (id: string, category: string | null) => {
    const value = (category || '').trim() || null;
    setDishes(prev =>
      prev.map(d => d.id === id ? { ...d, category: value } : d)
    );
    const ok = await db.updateDishCategory(id, value);
    if (!ok) console.error('Aktualizacja kategorii nie powiodła się');
  };

  const handleBuyPlan = async (planType: PricingPlanType) => {
    try {
      let userId = currentUser?.id;
      if (!userId) {
        const profile = await authService.getCurrentProfile();
        if (!profile) {
          alert('Musisz być zalogowany, aby dokonać zakupu.');
          return;
        }
        userId = profile.id;
        setCurrentUser(profile);
      }

      await createCheckoutSession({
        userId,
        planType,
        successUrl: `${window.location.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${window.location.origin}/#/cennik`,
      });
    } catch (err: any) {
      console.error('Stripe Checkout:', err);
      throw err;
    }
  };

  const handleBuyPremium = async () => {
    try {
      await handleBuyPlan('premium');
    } catch (err: any) {
      alert(err.message || 'Nie udało się otworzyć płatności.');
    }
  };

  if (isPricingPage && session) {
    return (
      <PricingPage
        subscriptionStatus={currentUser?.subscriptionStatus}
        onBack={() => {
          window.location.hash = '';
          setHash('');
        }}
        onBuy={handleBuyPlan}
      />
    );
  }

  if (isSuccessPage) {
    return (
      <SuccessPage
        onBack={() => { window.location.hash = ''; }}
        onPremiumActivated={async () => {
          const profile = await authService.getCurrentProfile();
          if (profile) setCurrentUser(profile);
        }}
      />
    );
  }

  if (isPublicMenu) {
    const usePathRouting = pathname.startsWith('/menu/');
    return (
      <PublicMenu
        dishes={dishes}
        dishId={publicDishId}
        userId={publicMenuUserId}
        usePathRouting={usePathRouting}
        onPathChange={() => setPathname(window.location.pathname)}
        showWatermark={publicHasWatermark}
        loading={publicMenuLoading}
        hubSectionId={publicHubSectionId}
        initialMenuMode={publicMenuMode}
      />
    );
  }

  if (isSyncing) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-chef-gold" size={48} />
      </div>
    );
  }

  if (!session) {
    return <Auth onDemoLogin={() => setSession({ user: { id: 'demo' } })} />;
  }

  const settingsSectionActive = settingsSectionFromTab(activeTab);
  const settingsMenuOpen = settingsExpanded || settingsSectionActive !== null;

  const handleNavClick = (tabId: AppTab, premiumLocked?: boolean) => {
    if (isFree && premiumLocked) {
      openPremiumUpsell();
      setIsSidebarOpen(false);
      return;
    }
    setActiveTab(tabId);
    if (!isSettingsTab(tabId)) setSettingsExpanded(false);
    setIsSidebarOpen(false);
  };

  const handleSettingsToggle = () => {
    setSettingsExpanded((open) => !open);
  };

  const handleSettingsSubClick = (tabId: AppTab) => {
    setActiveTab(tabId);
    setSettingsExpanded(true);
    setIsSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-chef-cream overflow-hidden">
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-chef-dark/60 backdrop-blur-sm z-[90] lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      <aside
        className={`fixed lg:relative inset-y-0 left-0 w-72 flex-shrink-0 flex flex-col z-[100] h-full max-h-screen overflow-hidden transform transition-transform duration-300 ease-in-out border-r border-white/[0.08] bg-[#121212] ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className="p-6 lg:p-8 flex-1 min-h-0 overflow-y-auto">
          <div className="flex items-center gap-4 mb-8 lg:mb-10">
            <img
              src={BRAND_LOGO_SRC}
              alt=""
              width={56}
              height={56}
              className="h-14 w-14 rounded-2xl object-cover shrink-0"
            />
            <div className="leading-none">
              <h1 className="text-2xl font-black tracking-tighter italic text-white">Chefvision</h1>
              <span className="mt-1 block text-right text-[10px] font-black uppercase tracking-[0.25em] text-white">BETA</span>
            </div>
          </div>

          <nav className="space-y-2">
            {NAV_ITEM_DEFS.map((tab) => {
              const locked = isFree && tab.premiumLocked;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleNavClick(tab.id, tab.premiumLocked)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-black transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 ${
                    activeTab === tab.id && !locked ? 'text-white bg-white/5' : 'text-zinc-500 hover:text-white'
                  } ${locked ? 'hover:bg-white/[0.03]' : ''}`}
                >
                  <div className="flex items-center gap-4 text-left min-w-0">
                    <span className="w-5 shrink-0 flex justify-center">
                      <tab.icon size={20} className={locked ? 'opacity-70' : undefined} />
                    </span>
                    <span className="leading-tight">{tNav(tab.labelKey)}</span>
                  </div>
                  {locked && (
                    <Lock size={14} className="shrink-0 text-zinc-500 group-hover:text-emerald-400/80 transition-colors" aria-hidden />
                  )}
                </button>
              );
            })}

            <div className="pt-1">
              <button
                type="button"
                onClick={handleSettingsToggle}
                aria-expanded={settingsMenuOpen}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 ${
                  settingsSectionActive ? 'text-white bg-white/5' : 'text-zinc-500 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-4 text-left min-w-0">
                  <span className="w-5 shrink-0 flex justify-center">
                    <Settings size={20} />
                  </span>
                  <span className="leading-tight">{tNav('settings')}</span>
                </div>
                {settingsMenuOpen ? (
                  <ChevronDown size={18} className="shrink-0 text-zinc-400" aria-hidden />
                ) : (
                  <ChevronRight size={18} className="shrink-0 text-zinc-400" aria-hidden />
                )}
              </button>

              {settingsMenuOpen && (
                <div className="mt-1 ml-4 pl-4 border-l border-white/10 space-y-0.5">
                  {SETTINGS_SUB_NAV.map((sub) => {
                    const subActive = activeTab === sub.id;
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => handleSettingsSubClick(sub.id)}
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                          subActive
                            ? 'text-white bg-white/10'
                            : 'text-zinc-500 hover:text-white hover:bg-white/[0.04]'
                        }`}
                      >
                        {tNav(sub.labelKey)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </nav>
        </div>

        <div className="flex-shrink-0 p-6 lg:p-8 border-t border-white/10 space-y-4 bg-[#121212]">
          <div className="flex items-center gap-3 text-white">
            <div className="w-11 h-11 bg-[#1a1a1a] rounded-xl flex items-center justify-center text-zinc-400 border border-white/10 shrink-0">
              <UserIcon size={22} />
            </div>
            <div className="overflow-hidden flex-1 min-w-0">
              <p className="text-sm font-black truncate text-white">
                {currentUser?.name || tSidebar('defaultRestaurantName')}
              </p>
              <p className="text-[11px] font-medium truncate text-zinc-400 mt-0.5">
                {currentUser?.email || '—'}
              </p>
            </div>
          </div>

          {isFree ? (
            <FreePlanUpgradeCard onUpgrade={openPricingPage} />
          ) : isTrial ? (
            <TrialPlanUpgradeCard
              statusLabel={formatTokenStatusI18n(
                currentUser?.subscriptionStatus,
                currentUser?.credits ?? 0,
                currentUser?.tokens,
                currentUser?.trialEndsAt
              )}
              onUpgrade={openPricingPage}
            />
          ) : isStart ? (
            <div className="p-3 rounded-2xl border transition-all bg-emerald-500/10 border-emerald-500/20 text-emerald-300">
              <div className="flex items-center gap-2">
                <Crown size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  {formatTokenStatusI18n(
                    currentUser?.subscriptionStatus,
                    currentUser?.credits ?? 0,
                    currentUser?.tokens,
                    currentUser?.trialEndsAt
                  )}
                </span>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-2xl border transition-all bg-green-500/10 border-green-500/20 text-green-400">
              <div className="flex items-center gap-2">
                <Crown size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  {formatPremiumTokenShort(currentUser?.tokens?.total ?? currentUser?.credits ?? 0)}
                </span>
              </div>
            </div>
          )}
          <AppLanguageSwitcher />
          <button
            onClick={() => { authService.signOut(); setSession(null); }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest bg-white/10 text-white border border-white/10 hover:bg-red-500 hover:border-red-500 hover:text-white transition-colors"
          >
            <LogOut size={16} /> {tSidebar('logout')}
          </button>
        </div>
      </aside>

      <main className={`flex-1 overflow-y-auto ${startPromoBarVisible ? 'pb-28 sm:pb-24' : ''}`}>
        <header className="lg:hidden h-16 bg-white border-b border-slate-100 flex items-center justify-between px-6 sticky top-0 z-[80]">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-slate-600"><MenuIcon size={24} /></button>
          <div className="flex items-center gap-2">
            <img src={BRAND_LOGO_SRC} alt="" width={32} height={32} className="h-8 w-8 rounded-lg object-cover shrink-0" />
            <div className="leading-none">
              <span className="block font-black italic text-slate-900">Chefvision</span>
              <span className="mt-0.5 block text-right text-[9px] font-black uppercase tracking-[0.2em] text-black">BETA</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { authService.signOut(); setSession(null); }}
            className="p-2 text-slate-500 hover:text-red-600"
            title={tSidebar('logout')}
            aria-label={tSidebar('logout')}
          >
            <LogOut size={22} />
          </button>
        </header>

        <div className="p-6 md:p-10 max-w-5xl mx-auto min-h-0 w-full">
          {activeTab === 'kuchnia' && (
            <div className="space-y-8">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight italic">{tNav('kuchnia')}</h2>
              <KitchenWall 
                dishes={dishes} 
                onApprove={handleApprove} 
                onOpenTraining={() => {}} 
                onSelect={setSelectedDishId} 
                onDelete={handleDeleteDish}
                selectedId={selectedDishId} 
              />
            </div>
          )}
          {activeTab === 'studio' && (
            currentUser ? (
              <div className="space-y-8">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight italic">{tNav('studio')}</h2>
                <ChefsStudio 
                onSaveStandard={handleSaveStandard} 
                hasProFeatures={hasProAccess}
                subscriptionStatus={currentUser.subscriptionStatus}
                trialEndsAt={currentUser.trialEndsAt}
                generationsUsed={currentUser.generationsUsed}
                credits={currentUser.credits}
                tokens={currentUser.tokens}
                onGenerationSuccess={handleGenerationSuccess}
                onCreditsUpdated={handleCreditsUpdated}
                onRequestPremium={openPremiumUpsell}
              />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-center text-slate-500 min-h-[50vh]">
                <Loader2 className="animate-spin text-chef-gold mb-4" size={40} />
                <p className="font-medium">{tStudio('loadingProfile')}</p>
                <p className="text-sm mt-1">{tStudio('loadingHint')}</p>
              </div>
            )
          )}
          {activeTab === 'themes' && (
            currentUser ? (
              <SeasonalThemes
                onSaveStandard={handleSaveStandard}
                hasProFeatures={hasProAccess}
                subscriptionStatus={currentUser.subscriptionStatus}
                trialEndsAt={currentUser.trialEndsAt}
                generationsUsed={currentUser.generationsUsed}
                credits={currentUser.credits}
                tokens={currentUser.tokens}
                savedBackdrops={savedBackdrops}
                onGenerationSuccess={handleGenerationSuccess}
                onCreditsUpdated={handleCreditsUpdated}
                onRequestPremium={openPremiumUpsell}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-center text-slate-500 min-h-[50vh]">
                <Loader2 className="animate-spin text-chef-gold mb-4" size={40} />
                <p className="font-medium">{tThemes('loadingProfile')}</p>
              </div>
            )
          )}
          {activeTab === 'backdrops' && (
            <BackdropLab
              onSaveBackdrop={handleSaveBackdrop}
              showFreeWatermark={isFree}
              canUseAi={hasProAccess && (currentUser?.credits ?? 0) > 0}
              onRequestPremium={openPremiumUpsell}
            />
          )}
          {activeTab === 'menu' && (
            <MenuManager 
              dishes={dishes} 
              onToggleOnline={toggleStatus}
              onToggleHotelHub={toggleHotelHubVisibility}
              onUpdateHubAssignments={handleUpdateHubAssignments}
              onUpdateVideo={handleUpdateSocialLink} 
              onDelete={handleDeleteDish} 
              onSelect={setSelectedDishId}
              onUpdateMenuPrice={handleUpdateDishMenuPrice}
              onUpdateCategory={handleUpdateDishCategory}
              menuUserId={currentUser?.id ?? null}
              hotelHubAvailable={hasHotelHubAccess}
            />
          )}
          {activeTab === 'hotel-hub' && (
            hasHotelHubAccess ? (
              <HotelHubManager
                userId={session?.user?.id === 'demo' ? 'local-chef' : currentUser?.id ?? null}
              />
            ) : (
              <div className="space-y-6">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight italic flex items-center gap-3">
                  <Building2 className="text-chef-gold" size={32} />
                  {tHotelHub('title')}
                </h2>
                <div className="bg-white border border-slate-100 rounded-[32px] p-8 shadow-sm text-center space-y-4">
                  <p className="text-slate-600 text-sm max-w-lg mx-auto">
                    {tHotelHub('upsell.beforePlans')}{' '}
                    <strong>Trial</strong> {tHotelHub('upsell.plansJoiner')} <strong>Premium</strong>.{' '}
                    {tHotelHub('upsell.afterPlans')}
                  </p>
                  <button
                    type="button"
                    onClick={openPricingPage}
                    className="inline-flex px-6 py-3 rounded-2xl font-black text-sm text-[#0a1a12] bg-gradient-to-r from-emerald-400 to-green-500 shadow-[0_0_20px_rgba(52,211,153,0.3)] hover:from-emerald-300 hover:to-green-400 transition-all"
                  >
                    {tHotelHub('upsell.unlockPremium')}
                  </button>
                </div>
              </div>
            )
          )}
          {activeTab === 'stats' && (
            <MenuStatsPanel userId={currentUser?.id ?? null} />
          )}
          {activeTab === 'promotions' && (
            <div className="space-y-6">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight italic">{tPromotions('title')}</h2>
              {hasProAccess ? (
                <PromotionsManager
                  dishes={dishes}
                  userId={session?.user?.id === 'demo' ? 'local-chef' : currentUser?.id ?? null}
                />
              ) : (
                <div className="bg-white border border-slate-100 rounded-[32px] p-8 shadow-sm text-center space-y-4">
                  <p className="text-slate-600 text-sm">{tPromotions('premiumRequired')}</p>
                  <button
                    type="button"
                    onClick={openPremiumUpsell}
                    className="inline-flex px-6 py-3 rounded-2xl font-black text-sm text-[#0a1a12] bg-gradient-to-r from-emerald-400 to-green-500 shadow-[0_0_20px_rgba(52,211,153,0.3)] hover:from-emerald-300 hover:to-green-400 transition-all"
                  >
                    {tPromotions('unlockPremium')}
                  </button>
                </div>
              )}
            </div>
          )}
          {settingsSectionActive && (
            <SettingsPanel
              section={settingsSectionActive}
              userId={currentUser?.id ?? null}
              restaurantName={currentUser?.name}
            />
          )}
        </div>
      </main>

      {/* Panel edycji tylko na zakładkach z listą dań — inaczej fixed z-[200] przykrywał Chef’s Studio i pola były „martwe”. */}
      {(activeTab === 'kuchnia' || activeTab === 'menu') && selectedDishId && (
        <DishDetailPanel 
          dish={dishes.find(d => d.id === selectedDishId)!} 
          onClose={() => setSelectedDishId(null)} 
          onSave={handleUpdateDish}
          userId={currentUser?.id}
        />
      )}

      {statusToast && (
        <div
          key={statusToast}
          className="toast-in fixed bottom-8 left-1/2 z-[200] flex items-center gap-2 px-5 py-3 rounded-2xl bg-chef-dark text-white text-sm font-bold shadow-xl border border-chef-dark2/50"
          role="status"
          aria-live="polite"
        >
          <CheckCircle size={20} className="flex-shrink-0 text-green-400" />
          {statusToast}
        </div>
      )}

      <PremiumUpsellModal
        open={premiumUpsellOpen}
        onClose={() => setPremiumUpsellOpen(false)}
        onUpgrade={() => void handleBuyPremium()}
      />

      <StartPlanPromoBar
        subscriptionStatus={currentUser?.subscriptionStatus}
        onViewPlans={openPricingPage}
        onVisibilityChange={setStartPromoBarVisible}
      />
    </div>
  );
};

export default App;
