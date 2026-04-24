import React, { useRef, useState } from 'react';
import {
  TRIAL_AI_CREDITS,
  MAX_ENHANCE_PREVIEWS,
  SEASONAL_THEMES,
  DEFAULT_LIGHTING,
  PLATE_OPTIONS,
  ANGLE_OPTIONS,
  STYLE_OPTIONS,
  type SeasonalThemeId,
} from '../constants';
import { compressImageForUpload } from '../services/imageService';
import { enhanceDishImage, type GenerationResult } from '../services/aiService';
import {
  addFreeWatermark,
  downloadDataUrl,
  safeImageFileBase,
  shareImageViaSystem,
} from '../services/imageClient';
import { GeneratorParams } from '../types';
import { WatermarkWrapper } from './WatermarkWrapper';
import {
  AlertCircle,
  CheckCircle,
  Crown,
  Download,
  Image as ImageIcon,
  Loader2,
  Save,
  Share2,
  Sparkles,
  Plus,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import type { Backdrop } from '../types';

interface Props {
  onSaveStandard: (imageUrl: string, params: GeneratorParams) => void;
  isSubscribed: boolean;
  generationsUsed: number;
  credits: number;
  savedBackdrops?: Backdrop[];
  onGenerationSuccess?: () => void;
  onCreditsUpdated?: (credits: number) => void;
  onBuyPremium?: () => void;
}

const STEP_LABEL_CLS = 'text-[10px] font-black uppercase tracking-widest text-slate-400';
const STEP_CARD_CLS = 'bg-white border border-slate-100 rounded-[32px] p-6 space-y-4 shadow-sm';

const THEME_GRADIENTS: Record<SeasonalThemeId, string> = {
  christmas: 'from-rose-600 via-rose-500 to-emerald-700',
  easter: 'from-pink-300 via-yellow-200 to-emerald-300',
  halloween: 'from-amber-700 via-stone-800 to-black',
  summer: 'from-sky-400 via-amber-300 to-yellow-200',
  valentine: 'from-rose-500 via-pink-400 to-rose-700',
};

export const SeasonalThemes: React.FC<Props> = ({
  onSaveStandard,
  isSubscribed,
  generationsUsed,
  credits,
  savedBackdrops = [],
  onGenerationSuccess,
  onCreditsUpdated,
  onBuyPremium,
}) => {
  const [dishReference, setDishReference] = useState<string | null>(null);
  const [isUploadingRef, setIsUploadingRef] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dishRefInputRef = useRef<HTMLInputElement>(null);

  const [theme, setTheme] = useState<SeasonalThemeId | null>(null);
  const [customThemeImage, setCustomThemeImage] = useState<string | null>(null);
  const [customThemeLabel, setCustomThemeLabel] = useState<string | null>(null);
  const [isCustomThemeMenuOpen, setIsCustomThemeMenuOpen] = useState(false);
  const [isPickingStudioTheme, setIsPickingStudioTheme] = useState(false);
  const customThemeInputRef = useRef<HTMLInputElement>(null);

  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [saveTargetImage, setSaveTargetImage] = useState<string | null>(null);
  const [saveDishName, setSaveDishName] = useState('');
  const [shareTargetImage, setShareTargetImage] = useState<string | null>(null);

  const isFreeTrialOver = !isSubscribed && generationsUsed >= TRIAL_AI_CREDITS;
  const hasNoCredits = !isSubscribed && credits <= 0;
  const hasThemeSelected = !!theme || !!customThemeImage;
  const canGenerate = !!dishReference && hasThemeSelected && !isGenerating && !hasNoCredits;

  const onReferenceFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setIsUploadingRef(true);
    setError(null);
    try {
      const dataUrl = await compressImageForUpload(file);
      setDishReference(dataUrl);
    } catch (e: any) {
      setError(e?.message || 'Błąd przetwarzania zdjęcia.');
    } finally {
      setIsUploadingRef(false);
    }
  };

  const handleReferenceInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) void onReferenceFile(f);
  };

  const handleReferenceDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void onReferenceFile(f);
  };

  const handleGenerate = async () => {
    if (!dishReference) {
      setError('Wgraj zdjęcie dania (krok 1).');
      return;
    }
    if (!theme && !customThemeImage) {
      setError('Wybierz motyw sezonowy lub dodaj własny motyw (krok 2).');
      return;
    }
    if (hasNoCredits) {
      setError('Brak kredytów. Przejdź na plan Premium, aby kontynuować.');
      return;
    }
    setError(null);
    setIsGenerating(true);
    try {
      const result: GenerationResult = await enhanceDishImage(dishReference, {
        theme: customThemeImage ? undefined : theme ?? undefined,
        customThemeImage: customThemeImage ?? undefined,
      });
      let img = result.image;
      if (isFreeTrialOver) img = await addFreeWatermark(img);
      setGeneratedImages((prev) => [img, ...prev].slice(0, MAX_ENHANCE_PREVIEWS));
      if (result.creditsRemaining !== undefined) onCreditsUpdated?.(result.creditsRemaining);
      onGenerationSuccess?.();
    } catch (err: any) {
      setError(err?.message || 'Błąd generacji.');
    } finally {
      setIsGenerating(false);
    }
  };

  const confirmSaveToMenu = () => {
    if (!saveTargetImage || !saveDishName.trim()) return;
    const params: GeneratorParams = {
      dishName: saveDishName.trim(),
      lighting: DEFAULT_LIGHTING.value,
      plateType: PLATE_OPTIONS[0].value,
      cameraAngle: ANGLE_OPTIONS[0].value,
      style: STYLE_OPTIONS[0].value,
    };
    onSaveStandard(saveTargetImage, params);
    setSaveTargetImage(null);
    setSaveDishName('');
  };

  const shareImage = async () => {
    if (!shareTargetImage) return;
    const outcome = await shareImageViaSystem(shareTargetImage, 'Danie');
    if (outcome === 'shared' || outcome === 'cancelled') {
      setShareTargetImage(null);
      return;
    }
    alert(
      'Udostępnianie pliku nie jest dostępne w tej przeglądarce. Użyj „Pobierz”, a następnie dodaj plik w wybranej aplikacji.'
    );
  };

  const onCustomThemeFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setError(null);
    try {
      const dataUrl = await compressImageForUpload(file);
      setTheme(null);
      setCustomThemeImage(dataUrl);
      setCustomThemeLabel(file.name || 'Własny motyw');
    } catch (e: any) {
      setError(e?.message || 'Błąd wczytywania motywu z dysku.');
    }
  };

  const handleCustomThemeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) void onCustomThemeFile(f);
  };

  const pickStudioBackdrop = async (bg: Backdrop) => {
    setError(null);
    try {
      // Backdrops from Studio are usually URLs; convert to data URL so API can forward inline image data.
      const response = await fetch(bg.imageUrl);
      if (!response.ok) throw new Error('Nie udało się pobrać tła ze Studio.');
      const blob = await response.blob();
      const ext = blob.type.includes('png') ? 'png' : 'jpg';
      const file = new File([blob], `studio-backdrop.${ext}`, { type: blob.type || 'image/jpeg' });
      const dataUrl = await compressImageForUpload(file);

      setTheme(null);
      setCustomThemeImage(dataUrl);
      setCustomThemeLabel('Motyw ze Studio tła');
      setIsPickingStudioTheme(false);
    } catch (e: any) {
      setError(e?.message || 'Nie udało się użyć tła ze Studio jako motywu.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24">
      {/* Header */}
      <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-rose-50 text-rose-600 rounded-3xl">
            <Sparkles size={28} />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight italic">Motywy sezonowe</h2>
            <p className="text-xs text-slate-500 mt-1">
              Wybierz motyw — AI zamieni otoczenie zdjęcia w świąteczną scenę, samo danie zostaje bez zmian.
            </p>
          </div>
        </div>
        {!isSubscribed && (
          <div className="text-[10px] font-black uppercase tracking-widest">
            <span className={hasNoCredits ? 'text-red-500' : 'text-slate-400'}>
              Kredyty: {credits}/{TRIAL_AI_CREDITS}
            </span>
          </div>
        )}
      </div>

      {hasNoCredits && (
        <div className="bg-slate-900 border border-amber-500/30 p-6 rounded-[30px] flex items-center justify-between text-white">
          <div className="flex items-center gap-4">
            <Crown className="text-amber-500" />
            <div>
              <p className="font-black">Brak kredytów</p>
              <p className="text-xs opacity-60">Przejdź na plan Premium, aby korzystać z motywów.</p>
            </div>
          </div>
          <button
            onClick={onBuyPremium}
            className="bg-amber-500 text-slate-900 px-6 py-3 rounded-2xl font-black text-sm hover:bg-amber-400 transition-colors"
          >
            Plan Premium
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800">
          <AlertCircle className="shrink-0 mt-0.5" size={20} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold">Błąd</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
          <button type="button" onClick={() => setError(null)} className="p-1 rounded-lg hover:bg-red-100 text-red-600">
            <X size={18} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* LEFT: controls */}
        <div className="space-y-5">
          {/* Step 1 — Upload */}
          <div className={STEP_CARD_CLS}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black bg-slate-900 text-white">1</div>
              <h4 className="text-sm font-black tracking-tight text-slate-800">
                Wgraj zdjęcie dania <span className="text-red-500">*</span>
              </h4>
            </div>
            <input
              ref={dishRefInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleReferenceInput}
            />
            {dishReference ? (
              <div className="flex items-center gap-4 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <img src={dishReference} alt="Wgrane danie" className="w-20 h-20 object-cover rounded-xl" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800">Zdjęcie gotowe</p>
                  <p className="text-xs text-slate-500">Wybierz motyw poniżej.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDishReference(null)}
                  className="p-2 rounded-xl text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                  aria-label="Usuń zdjęcie"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleReferenceDrop}
                className={`block border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-colors ${
                  isDragging ? 'border-rose-500 bg-rose-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <input type="file" accept="image/*" className="sr-only" onChange={handleReferenceInput} />
                <div className="flex flex-col items-center gap-3 text-slate-500">
                  {isUploadingRef ? <Loader2 className="animate-spin" size={28} /> : <Upload size={28} />}
                  <p className="text-sm font-bold text-slate-700">Przeciągnij zdjęcie lub kliknij, aby wybrać</p>
                  <p className="text-xs text-slate-400">JPG / PNG / WEBP · do 1 MB</p>
                </div>
              </label>
            )}
          </div>

          {/* Step 2 — Theme (required) */}
          <div className={STEP_CARD_CLS}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black bg-slate-900 text-white">2</div>
              <h4 className="text-sm font-black tracking-tight text-slate-800">
                Wybierz motyw <span className="text-red-500">*</span>
              </h4>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {SEASONAL_THEMES.map((opt) => {
                const active = theme === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTheme(opt.id)}
                    className={`relative rounded-2xl p-4 text-left text-sm font-black transition-all border-2 overflow-hidden text-white bg-gradient-to-br ${THEME_GRADIENTS[opt.id]} ${active ? 'border-slate-900 ring-4 ring-slate-900/20 scale-[1.02]' : 'border-transparent hover:scale-[1.01]'}`}
                  >
                    {'cardImage' in opt && opt.cardImage && (
                      <img
                        src={opt.cardImage}
                        alt={opt.label}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    )}
                    <span className="relative z-10 drop-shadow-md">{opt.label}</span>
                    {active && (
                      <span className="absolute top-2 right-2 bg-white/90 text-slate-900 rounded-full p-1 z-10">
                        <CheckCircle size={14} />
                      </span>
                    )}
                    <div className="absolute inset-0 bg-black/25" />
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setIsCustomThemeMenuOpen(true)}
                className={`relative rounded-2xl p-4 text-left text-sm font-black transition-all border-2 overflow-hidden text-white ${
                  customThemeImage
                    ? 'border-slate-900 ring-4 ring-slate-900/20 scale-[1.02]'
                    : 'border-transparent hover:scale-[1.01]'
                } bg-gradient-to-br from-slate-700 via-slate-600 to-slate-800`}
              >
                {customThemeImage && (
                  <img
                    src={customThemeImage}
                    alt="Własny motyw"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                )}
                <span className="relative z-10 drop-shadow-md flex items-center gap-2">
                  <Plus size={14} /> Własny motyw
                </span>
                {customThemeImage && (
                  <span className="absolute top-2 right-2 bg-white/90 text-slate-900 rounded-full p-1 z-10">
                    <CheckCircle size={14} />
                  </span>
                )}
                <div className="absolute inset-0 bg-black/25" />
              </button>
            </div>
            <input
              ref={customThemeInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleCustomThemeInput}
            />
            {customThemeImage && (
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-3 min-w-0">
                  <img src={customThemeImage} alt="Własny motyw" className="w-12 h-12 rounded-lg object-cover" />
                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-800 truncate">Aktywny: własny motyw</p>
                    <p className="text-[11px] text-slate-500 truncate">{customThemeLabel || 'Wybrane ręcznie'}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCustomThemeImage(null);
                    setCustomThemeLabel(null);
                  }}
                  className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-700 shrink-0"
                >
                  Wyczyść
                </button>
              </div>
            )}
            <p className="text-[11px] text-slate-400 leading-snug">
              Motyw zmienia wyłącznie scenerię (rekwizyty, tło, oświetlenie). Nie modyfikuje kompozycji dania ani składników.
            </p>
          </div>

          {/* Generate */}
          <button
            onClick={() => void handleGenerate()}
            disabled={!canGenerate}
            className="w-full py-5 bg-chef-dark text-white rounded-[28px] font-black text-lg flex items-center justify-center gap-3 shadow-xl hover:bg-chef-dark2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? <Loader2 className="animate-spin" size={22} /> : <Wand2 size={22} />}
            {isGenerating ? 'TWORZĘ SCENĘ...' : hasNoCredits ? 'BRAK KREDYTÓW' : 'WYGENERUJ MOTYW'}
          </button>
        </div>

        {/* RIGHT: preview */}
        <div className="space-y-4">
          <div className="bg-white border border-slate-100 rounded-[32px] p-6 shadow-sm sticky top-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black tracking-tight text-slate-800 flex items-center gap-2">
                <Sparkles size={16} className="text-rose-500" /> Podgląd ({generatedImages.length}/{MAX_ENHANCE_PREVIEWS})
              </h4>
              {generatedImages.length > 0 && (
                <button
                  type="button"
                  onClick={() => setGeneratedImages([])}
                  className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-700"
                >
                  Wyczyść
                </button>
              )}
            </div>
            {generatedImages.length === 0 ? (
              <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 min-h-[360px] flex flex-col items-center justify-center text-center p-8 text-slate-400">
                <ImageIcon size={40} className="mb-3" />
                <p className="text-sm font-bold text-slate-500">Tutaj pojawi się zdjęcie w wybranym motywie</p>
                <p className="text-xs mt-1">Każde kolejne kliknięcie doda wariant (max {MAX_ENHANCE_PREVIEWS}).</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {generatedImages.map((src, idx) => (
                  <div key={idx} className="group relative rounded-2xl overflow-hidden border border-slate-100">
                    <WatermarkWrapper show={!isSubscribed} className="">
                      <img src={src} alt="Wariant" className="w-full h-auto block" />
                    </WatermarkWrapper>
                    <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => downloadDataUrl(src, `${safeImageFileBase('danie')}-${idx + 1}.png`)}
                        className="p-2 rounded-lg bg-white/90 text-slate-800 hover:bg-white"
                        title="Pobierz"
                      >
                        <Download size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setShareTargetImage(src)}
                        className="p-2 rounded-lg bg-white/90 text-slate-800 hover:bg-white"
                        title="Udostępnij"
                      >
                        <Share2 size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSaveTargetImage(src);
                          setSaveDishName('');
                        }}
                        className="p-2 rounded-lg bg-chef-gold text-white hover:bg-chef-gold2"
                        title="Zapisz do menu"
                      >
                        <Save size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save-to-menu modal */}
      {saveTargetImage && (
        <div className="fixed inset-0 z-[400] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-start gap-3">
              <h3 className="text-lg font-black text-slate-900">Zapisz do menu</h3>
              <button
                type="button"
                onClick={() => setSaveTargetImage(null)}
                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"
                aria-label="Zamknij"
              >
                <X size={18} />
              </button>
            </div>
            <img src={saveTargetImage} alt="Podgląd" className="w-full aspect-[4/3] object-cover rounded-2xl" />
            <label className="block space-y-2">
              <span className={STEP_LABEL_CLS}>Nazwa dania</span>
              <input
                type="text"
                autoFocus
                value={saveDishName}
                onChange={(e) => setSaveDishName(e.target.value)}
                placeholder="np. Polędwica Wellington"
                className="w-full px-4 py-3 border-2 border-slate-100 focus:ring-4 focus:ring-chef-beige/40 rounded-2xl outline-none text-slate-700"
              />
            </label>
            <button
              type="button"
              onClick={confirmSaveToMenu}
              disabled={!saveDishName.trim()}
              className="w-full py-4 bg-chef-gold text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-chef-gold2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle size={18} /> ZAPISZ
            </button>
          </div>
        </div>
      )}

      {/* Share modal */}
      {shareTargetImage && (
        <div className="fixed inset-0 z-[500] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-[28px] w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-start">
              <h3 className="text-lg font-black text-slate-900">Udostępnij</h3>
              <button
                type="button"
                onClick={() => setShareTargetImage(null)}
                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"
                aria-label="Zamknij"
              >
                <X size={18} />
              </button>
            </div>
            <img src={shareTargetImage} alt="Podgląd" className="w-full aspect-[4/3] object-cover rounded-2xl" />
            <button
              type="button"
              onClick={() => void shareImage()}
              className="w-full py-4 rounded-2xl bg-chef-dark text-white font-black text-sm flex items-center justify-center gap-2 hover:bg-chef-dark2 transition-colors"
            >
              <Share2 size={18} /> Udostępnij przez system
            </button>
            <button
              type="button"
              onClick={() => {
                downloadDataUrl(shareTargetImage, `${safeImageFileBase('danie')}.png`);
              }}
              className="w-full py-4 rounded-2xl border-2 border-slate-200 text-slate-800 font-black text-sm flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors"
            >
              <Download size={18} /> Pobierz plik
            </button>
          </div>
        </div>
      )}

      {isPickingStudioTheme && (
        <div className="fixed inset-0 z-[520] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] w-full max-w-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">Wybierz tło ze Studio</h3>
              <button
                type="button"
                onClick={() => setIsPickingStudioTheme(false)}
                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"
                aria-label="Zamknij"
              >
                <X size={18} />
              </button>
            </div>
            {savedBackdrops.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                Brak zapisanych teł w Studio tła. Najpierw zapisz tam tło, a potem wróć tutaj.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[55vh] overflow-auto pr-1">
                {savedBackdrops.map((bg) => (
                  <button
                    key={bg.id}
                    type="button"
                    onClick={() => pickStudioBackdrop(bg)}
                    className="group rounded-2xl overflow-hidden border-2 border-slate-200 hover:border-slate-400"
                  >
                    <img src={bg.imageUrl} alt="Tło ze Studio" className="w-full aspect-[4/3] object-cover group-hover:scale-[1.02] transition-transform" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {isCustomThemeMenuOpen && (
        <div className="fixed inset-0 z-[530] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] w-full max-w-md p-6 shadow-2xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">Własny motyw</h3>
              <button
                type="button"
                onClick={() => setIsCustomThemeMenuOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"
                aria-label="Zamknij"
              >
                <X size={18} />
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsCustomThemeMenuOpen(false);
                customThemeInputRef.current?.click();
              }}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-black text-slate-800 hover:bg-slate-100 flex items-center justify-center gap-2"
            >
              <Upload size={16} /> Pobierz z dysku
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCustomThemeMenuOpen(false);
                setIsPickingStudioTheme(true);
              }}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-black text-slate-800 hover:bg-slate-100 flex items-center justify-center gap-2"
            >
              <Plus size={16} /> Pobierz ze Studio tła
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
