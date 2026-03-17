
import React, { useState, useEffect } from 'react';
import { Dish, DishStatus, GeneratorParams, UserProfile, Backdrop } from './types';
import { ChefsStudio } from './components/ChefsStudio';
import { BackdropLab } from './components/BackdropLab';
import { PublicMenu } from './components/PublicMenu';
import { QRGenerator } from './components/QRGenerator';
import { UploadLogo } from './components/UploadLogo';
import { KitchenWall } from './components/KitchenWall';
import { MenuManager } from './components/MenuManager';
import { DishDetailPanel } from './components/DishDetailPanel';
import { Auth } from './components/Auth';
import { SuccessPage } from './components/SuccessPage';
import { supabase, db, authService, uploadDishImage } from './services/supabaseService';
import { createCheckoutSession, confirmPremiumSession } from './services/stripeService';
import { 
  ChefHat, 
  LayoutDashboard, 
  BookOpen, 
  User as UserIcon, 
  LogOut, 
  Menu as MenuIcon, 
  Zap,
  Crown,
  Layers,
  Loader2,
  AlertTriangle,
  Gift,
  CheckCircle
} from 'lucide-react';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [activeTab, setActiveTab] = useState<'kuchnia' | 'studio' | 'backdrops' | 'menu' | 'qr'>('kuchnia');
  const [selectedDishId, setSelectedDishId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [hash, setHash] = useState(window.location.hash);
  const [pathname, setPathname] = useState(window.location.pathname);
  const [savedBackdrops, setSavedBackdrops] = useState<Backdrop[]>([]);
  const [statusToast, setStatusToast] = useState<string | null>(null);
  const [publicHasWatermark, setPublicHasWatermark] = useState<boolean>(false);
  
  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await authService.getSession();
      setSession(session);
      setIsSyncing(false);
    };

    initAuth();

    let subscription: any = null;
    if (supabase) {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
      subscription = data.subscription;
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
    try {
      const hashMatch = hash.match(/#\/menu\/([^/?#]+)(?:\/dish\/([^/?#]+))?/);
      const pathMatch = pathname.match(/^\/menu\/([^/]+)(?:\/dish\/([^/]+))?\/?$/);
      const publicMenuUserId = hashMatch?.[1] ?? pathMatch?.[1] ?? null;
      if (publicMenuUserId) {
        const ownerProfile = await authService.getProfileById(publicMenuUserId);
        if (ownerProfile) {
          setPublicHasWatermark(ownerProfile.subscriptionStatus !== 'premium');
        } else {
          // Domyślnie traktuj jako wersję darmową – lepiej pokazać znak wodny niż go pominąć
          setPublicHasWatermark(true);
        }
        const data = await db.getDishesForPublicMenu(publicMenuUserId);
        setDishes(data);
      } else {
        if (session?.user?.id === 'demo') {
          const demoProfile: UserProfile = {
            id: 'local-chef',
            name: 'Restauracja Testowa',
            email: 'demo@chefvision.pl',
            subscriptionStatus: 'trial',
            generationsUsed: parseInt(typeof window !== 'undefined' ? localStorage.getItem('chefvision_user_gens') || '0' : '0'),
            credits: Math.max(0, 5 - parseInt(typeof window !== 'undefined' ? localStorage.getItem('chefvision_user_gens') || '0' : '0')),
          };
          setCurrentUser(demoProfile);
          const data = await db.getDishes('local-chef');
          setDishes(data);
        } else {
          let profile = await authService.getCurrentProfile();
          if (!profile && session?.user) {
            profile = {
              id: session.user.id,
              name: session.user.email?.split('@')[0] || 'Restauracja',
              email: session.user.email || '',
              subscriptionStatus: 'trial',
              generationsUsed: 0,
              credits: 5,
            };
          }
          setCurrentUser(profile);
          const restaurantId = profile ? profile.id : 'local-chef';
          const data = await db.getDishes(restaurantId);
          setDishes(data);
        }
      }
    } catch (e) { 
      console.error("Błąd synchronizacji:", e); 
    } finally { 
      setIsSyncing(false);
      setIsInitialLoad(false);
    }
  };

  const isPremium = currentUser?.subscriptionStatus === 'premium';
  const isTrial = currentUser?.subscriptionStatus === 'trial';

  const handleSaveBackdrop = (imageUrl: string) => {
    const newBackdrop: Backdrop = {
      id: `backdrop_${Date.now()}`,
      imageUrl,
    };
    setSavedBackdrops(prev => [newBackdrop, ...prev]);
  };

  const hashMatch = hash.match(/#\/menu\/([^/?#]+)(?:\/dish\/([^/?#]+))?/);
  const pathMatch = pathname.match(/^\/menu\/([^/]+)(?:\/dish\/([^/]+))?\/?$/);
  const publicMenuUserId = hashMatch?.[1] ?? pathMatch?.[1] ?? null;
  const publicDishId = hashMatch?.[2] ?? pathMatch?.[2] ?? null;
  const isPublicMenu = !!publicMenuUserId;
  const isSuccessPage = hash.includes('#/success');

  const handleGenerationSuccess = async () => {
    if (!currentUser) return;
    const { generationsUsed, credits } = await authService.incrementGenerations(currentUser.id);
    setCurrentUser(prev => prev ? { ...prev, generationsUsed, credits } : null);
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
        description: 'Krótki opis, który zobaczy gość...',
        technique: 'Wpisz technologię przygotowania dania...',
        ingredients: [],
        allergens: [],
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
      const msg = e instanceof Error ? e.message : 'Nie udało się zapisać dania.';
      if (msg.includes('QuotaExceeded') || msg.includes('quota')) {
        alert('Obraz jest za duży do zapisania w tej przeglądarce. Zaloguj się (Supabase), aby zapisywać zdjęcia w chmurze.');
      } else {
        alert(msg);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateDish = async (updatedDish: Dish) => {
    setIsSyncing(true);
    const saved = await db.saveDish(updatedDish);
    if (saved) {
      setDishes(prev => prev.map(d => d.id === saved.id ? saved : d));
      setSelectedDishId(null);
    }
    setIsSyncing(false);
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
      setStatusToast('Status dania zaktualizowany');
      setTimeout(() => setStatusToast(null), 3000);
    }
  };

  const handleDeleteDish = async (id: string) => {
    const dish = dishes.find(d => d.id === id);
    if (!dish) return;
    const ok = await db.deleteDishWithImage(dish);
    if (ok) {
      setDishes(prev => prev.filter(d => d.id !== id));
    } else {
      alert('Nie udało się usunąć dania. Spróbuj ponownie.');
    }
  };

  const handleUpdateSocialLink = async (id: string, url: string) => {
    setDishes(prev => prev.map(d => d.id === id ? { ...d, videoUrl: url } : d));
    const ok = await db.updateDishSocialLink(id, url);
    if (!ok) console.error('Aktualizacja Social Link nie powiodła się');
  };

  const handleUpdateDishPrice = async (id: string, price: string) => {
    const normalized = price.replace(/[^\d.,]/g, '').trim();
    setDishes(prev =>
      prev.map(d =>
        d.id === id ? { ...d, menuPrice: normalized || null } : d
      )
    );
    const ok = await db.updateDishPrice(id, normalized || null);
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

  const handleBuyPremium = async () => {
    try {
      // Upewnij się, że mamy aktualne userId z Supabase
      let userId = currentUser?.id;
      if (!userId) {
        const profile = await authService.getCurrentProfile();
        if (!profile) {
          alert('Musisz być zalogowany, aby kupić Premium.');
          return;
        }
        userId = profile.id;
        setCurrentUser(profile);
      }

      await createCheckoutSession({
        userId,
        successUrl: `${window.location.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: window.location.origin,
      });
    } catch (err: any) {
      console.error('Stripe Checkout:', err);
      alert(err.message || 'Nie udało się otworzyć płatności.');
    }
  };

  // DEBUG: ręczne wymuszenie Premium i kredytów
  const handleDebugSetPremium = async () => {
    try {
      let userId = currentUser?.id;
      if (!userId) {
        const profile = await authService.getCurrentProfile();
        if (!profile) return;
        userId = profile.id;
        setCurrentUser(profile);
      }
      const ok = await authService.setPremiumStatus(userId!);
      if (ok) {
        const profile = await authService.getCurrentProfile();
        if (profile) setCurrentUser(profile);
      }
    } catch (e) {
      console.error('DEBUG setPremium', e);
    }
  };

  const handleDebugAddCredits = async () => {
    try {
      let userId = currentUser?.id;
      if (!userId) {
        const profile = await authService.getCurrentProfile();
        if (!profile) return;
        userId = profile.id;
        setCurrentUser(profile);
      }

      if (supabase) {
        const { data, error } = await supabase
          .from('profiles')
          .update({ ai_credits: (currentUser?.credits ?? 0) + 5 })
          .eq('id', userId!)
          .select('ai_credits')
          .single();
        if (!error) {
          setCurrentUser(prev => prev ? {
            ...prev,
            credits: data?.ai_credits ?? prev.credits + 5,
            subscriptionStatus: prev.subscriptionStatus === 'free_limited' && (data?.ai_credits ?? 0) > 0
              ? 'trial'
              : prev.subscriptionStatus
          } : prev);
        }
      } else {
        // Tryb demo (bez Supabase) – tylko lokalny stan
        setCurrentUser(prev => prev ? {
          ...prev,
          credits: prev.credits + 5,
          subscriptionStatus: prev.subscriptionStatus === 'free_limited' ? 'trial' : prev.subscriptionStatus
        } : prev);
      }
    } catch (e) {
      console.error('DEBUG addCredits', e);
    }
  };

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
        dishes={dishes.filter(d => d.isOnline === true)}
        dishId={publicDishId}
        userId={publicMenuUserId}
        usePathRouting={usePathRouting}
        onPathChange={() => setPathname(window.location.pathname)}
        showWatermark={publicHasWatermark}
        loading={isSyncing}
      />
    );
  }

  if (isSyncing) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-amber-500" size={48} />
      </div>
    );
  }

  if (!session) {
    return <Auth onDemoLogin={() => setSession({ user: { id: 'demo' } })} />;
  }

  const navItems = [
    { id: 'kuchnia', label: 'Dashboard', icon: LayoutDashboard, protected: false },
    { id: 'studio', label: 'Chef’s Studio', icon: Zap, protected: false },
    { id: 'backdrops', label: 'Studio Tła', icon: Layers, protected: false },
    { id: 'menu', label: 'Menu Cyfrowe', icon: BookOpen, protected: false },
    { id: 'qr', label: 'Kod QR / Logo', icon: MenuIcon, protected: false },
  ];

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[90] lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      <aside className={`fixed lg:relative inset-y-0 left-0 w-72 bg-slate-950 flex-shrink-0 flex flex-col z-[100] transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-10 flex-1">
          <div className="flex items-center gap-4 mb-14">
            <div className="bg-amber-500 p-3 rounded-2xl shadow-xl shadow-amber-500/20"><ChefHat size={32} className="text-white" /></div>
            <h1 className="text-2xl font-black tracking-tighter italic text-white">Chefvision</h1>
          </div>

          <nav className="space-y-2">
            {navItems.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id as any); setIsSidebarOpen(false); }}
                className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl text-sm font-black transition-all group ${activeTab === tab.id ? 'bg-amber-500 text-white shadow-2xl' : 'text-slate-500 hover:text-white hover:bg-slate-900'}`}
              >
                <div className="flex items-center gap-4">
                  <tab.icon size={20} /> {tab.label}
                </div>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-10 border-t border-slate-900 space-y-6">
          <div className={`p-4 rounded-2xl border transition-all ${isPremium ? 'bg-green-500/10 border-green-500/20 text-green-400' : isTrial ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
             <div className="flex items-center gap-2 mb-1">
                {isPremium ? <Crown size={16} /> : isTrial ? <Gift size={16} /> : <AlertTriangle size={16} />}
                <span className="text-[10px] font-black uppercase tracking-widest">
                  {isPremium ? 'Konto Premium' : isTrial ? `Tryb Trial: ${currentUser?.generationsUsed}/5` : 'Limit Darmowy'}
                </span>
             </div>
          </div>
          {/* Duży, widoczny przycisk Wyloguj tuż pod statusem konta */}
          <button
            onClick={() => { authService.signOut(); setSession(null); }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest bg-slate-900 text-slate-300 hover:bg-red-500 hover:text-white transition-colors"
          >
            <LogOut size={16} /> Wyloguj
          </button>
          {/* DEBUG – narzędzia testowe dla Stripe / kredytów */}
          {currentUser && (
            <div className="space-y-2">
              <button
                onClick={handleDebugSetPremium}
                className="w-full px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-900 text-slate-300 hover:bg-slate-800 transition-colors"
              >
                DEBUG: Ustaw Premium
              </button>
              <button
                onClick={handleDebugAddCredits}
                className="w-full px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-900 text-slate-300 hover:bg-slate-800 transition-colors"
              >
                DEBUG: Dodaj 5 kredytów
              </button>
            </div>
          )}
          <div className="flex items-center gap-4 text-white">
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-slate-400 border border-slate-800">
              <UserIcon size={20} />
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-[10px] font-black truncate text-slate-500">
                {currentUser?.email || 'Twoja Restauracja'}
              </p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <header className="lg:hidden h-16 bg-white border-b border-slate-100 flex items-center justify-between px-6 sticky top-0 z-[80]">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-slate-600"><MenuIcon size={24} /></button>
          <div className="flex items-center gap-2"><ChefHat size={20} className="text-amber-500" /><span className="font-black italic text-slate-900">Chefvision</span></div>
          <div className="w-10" />
        </header>

        <div className="p-6 md:p-10 max-w-5xl mx-auto min-h-0 w-full">
          {activeTab === 'kuchnia' && (
            <div className="space-y-8">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight italic">Status Kuchni</h2>
              <KitchenWall 
                dishes={dishes} 
                onApprove={handleApprove} 
                onOpenTraining={() => {}} 
                onSelect={setSelectedDishId} 
                selectedId={selectedDishId} 
              />
            </div>
          )}
          {activeTab === 'studio' && (
            currentUser ? (
              <ChefsStudio 
                onSaveStandard={handleSaveStandard} 
                savedBackdrops={savedBackdrops} 
                isSubscribed={isPremium}
                generationsUsed={currentUser.generationsUsed}
                credits={currentUser.credits}
                onGenerationSuccess={handleGenerationSuccess}
                onCreditsUpdated={(credits) => setCurrentUser(prev => prev ? { ...prev, credits } : null)}
                onBuyPremium={handleBuyPremium}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-center text-slate-500 min-h-[50vh]">
                <Loader2 className="animate-spin text-amber-500 mb-4" size={40} />
                <p className="font-medium">Ładowanie profilu...</p>
                <p className="text-sm mt-1">Za chwilę Chef’s Studio będzie dostępne.</p>
              </div>
            )
          )}
          {activeTab === 'backdrops' && (
            <BackdropLab onSaveBackdrop={handleSaveBackdrop} isTrial={!isPremium} />
          )}
          {activeTab === 'menu' && (
            <MenuManager 
              dishes={dishes} 
              onToggleOnline={toggleStatus} 
              onUpdateVideo={handleUpdateSocialLink} 
              onDelete={handleDeleteDish} 
              onSelect={setSelectedDishId}
              onUpdatePrice={handleUpdateDishPrice}
              onUpdateCategory={handleUpdateDishCategory}
              menuUserId={currentUser?.id ?? null}
            />
          )}
          {activeTab === 'qr' && (
            <div className="space-y-10">
              {currentUser?.id && (
                <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100">
                  <UploadLogo userId={currentUser.id} />
                </div>
              )}
              <QRGenerator userId={currentUser?.id ?? null} />
            </div>
          )}
        </div>
      </main>

      {selectedDishId && (
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
          className="toast-in fixed bottom-8 left-1/2 z-[200] flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-900 text-white text-sm font-bold shadow-xl border border-slate-700/50"
          role="status"
          aria-live="polite"
        >
          <CheckCircle size={20} className="flex-shrink-0 text-green-400" />
          {statusToast}
        </div>
      )}
    </div>
  );
};

export default App;
