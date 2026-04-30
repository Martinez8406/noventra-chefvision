import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  TRIAL_AI_CREDITS,
  MAX_ENHANCE_PREVIEWS,
  ENHANCE_STYLES,
  DEFAULT_LIGHTING,
  PLATE_OPTIONS,
  ANGLE_OPTIONS,
  STYLE_OPTIONS,
  type EnhanceStyleId,
} from '../constants';
import { compressImageForUpload } from '../services/imageService';
import { enhanceDishImage, type EnhanceSettings, type GenerationResult } from '../services/aiService';
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
  Palette,
  Save,
  Share2,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  X,
} from 'lucide-react';

interface Props {
  onSaveStandard: (imageUrl: string, params: GeneratorParams) => void;
  isSubscribed: boolean;
  generationsUsed: number;
  credits: number;
  onGenerationSuccess?: () => void;
  onCreditsUpdated?: (credits: number) => void;
  onBuyPremium?: () => void;
}

const STEP_LABEL_CLS = 'text-[10px] font-black uppercase tracking-widest text-slate-400';
const STEP_CARD_CLS = 'bg-white border border-slate-100 rounded-[32px] p-6 space-y-4 shadow-sm';

function StepHeader({ n, title, required, disabled }: { n: number; title: string; required?: boolean; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black ${disabled ? 'bg-slate-100 text-slate-300' : 'bg-slate-900 text-white'}`}
      >
        {n}
      </div>
      <h4 className={`text-sm font-black tracking-tight ${disabled ? 'text-slate-300' : 'text-slate-800'}`}>
        {title}
        {required && <span className="ml-1 text-red-500">*</span>}
      </h4>
    </div>
  );
}

function EnhanceStyleCard({
  option,
  active,
  onSelect,
}: {
  option: (typeof ENHANCE_STYLES)[number];
  active: boolean;
  onSelect: () => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      title={option.label}
      className={`group relative aspect-square h-[148px] w-[148px] overflow-hidden rounded-2xl border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-chef-gold focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
        active
          ? 'border-chef-gold shadow-[0_0_0_3px_rgba(187,152,96,0.35)]'
          : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${option.cardPlaceholder}`} aria-hidden />
      {!imageFailed && (
        <img
          src={option.cardImage}
          alt=""
          className="absolute inset-0 z-[1] h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          onError={() => setImageFailed(true)}
        />
      )}
      <div
        className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-t from-black/90 via-black/30 to-transparent"
        aria-hidden
      />
      <span className="pointer-events-none absolute bottom-2.5 left-2.5 right-2 z-[3] text-left text-[13px] font-black leading-tight tracking-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)]">
        {option.label}
      </span>
    </button>
  );
}

function QuickAddOriginalCard({
  disabled,
  onClick,
}: {
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? 'Najpierw wgraj zdjęcie w kroku 1' : 'Dodaj zdjęcie bez ulepszania'}
      className={`group relative aspect-square h-[148px] w-[148px] overflow-hidden rounded-2xl border-2 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-chef-gold focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
        disabled
          ? 'cursor-not-allowed border-slate-100 bg-slate-50'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
      }`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700" aria-hidden />
      <div className="absolute inset-0 z-[1] bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.16),rgba(255,255,255,0)_55%)]" aria-hidden />
      <div className="relative z-[2] flex h-full flex-col items-start justify-between p-3.5">
        <span className="inline-flex items-center gap-1 rounded-xl bg-white/15 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-white">
          <Upload size={12} />
          Bez AI
        </span>
        <span className="text-[13px] font-black leading-tight tracking-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)]">
          Dodaj zdjęcie
          <br />
          bez ulepszania
        </span>
      </div>
    </button>
  );
}

export const ChefsStudio: React.FC<Props> = ({
  onSaveStandard,
  isSubscribed,
  generationsUsed,
  credits,
  onGenerationSuccess,
  onCreditsUpdated,
  onBuyPremium,
}) => {
  // ── Step 1: uploaded dish photo ─────────────────────────────────────────────
  const [dishReference, setDishReference] = useState<string | null>(null);
  const [isUploadingRef, setIsUploadingRef] = useState(false);
  const [isDraggingRef, setIsDraggingRef] = useState(false);
  const dishRefInputRef = useRef<HTMLInputElement>(null);

  // ── Step 2: settings ─────────────────────────────────────────────────────────
  // Uwaga: TŁO jest ustalane automatycznie przez styl (backend, STYLE_DEFAULT_BG).
  const [style, setStyle] = useState<EnhanceStyleId | null>(null);
  const styleScrollerRef = useRef<HTMLDivElement>(null);
  const [styleScrollValue, setStyleScrollValue] = useState(0);
  const [hasStyleOverflow, setHasStyleOverflow] = useState(false);

  // ── Generation state ───────────────────────────────────────────────────────
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Save-to-menu state ─────────────────────────────────────────────────────
  const [saveTargetImage, setSaveTargetImage] = useState<string | null>(null);
  const [saveDishName, setSaveDishName] = useState('');

  // ── Share state ────────────────────────────────────────────────────────────
  const [shareTargetImage, setShareTargetImage] = useState<string | null>(null);

  const isFreeTrialOver = !isSubscribed && generationsUsed >= TRIAL_AI_CREDITS;
  const hasNoCredits = !isSubscribed && credits <= 0;
  const canGenerate = !!dishReference && !!style && !isGenerating && !hasNoCredits;

  const currentEnhanceSettings: EnhanceSettings = useMemo(
    () => ({
      style: style ?? undefined,
    }),
    [style]
  );

  useEffect(() => {
    const scroller = styleScrollerRef.current;
    if (!scroller) return;

    const syncScrollState = () => {
      const maxScrollLeft = Math.max(scroller.scrollWidth - scroller.clientWidth, 0);
      setHasStyleOverflow(maxScrollLeft > 0);
      setStyleScrollValue(maxScrollLeft === 0 ? 0 : (scroller.scrollLeft / maxScrollLeft) * 100);
    };

    syncScrollState();
    scroller.addEventListener('scroll', syncScrollState);
    window.addEventListener('resize', syncScrollState);

    return () => {
      scroller.removeEventListener('scroll', syncScrollState);
      window.removeEventListener('resize', syncScrollState);
    };
  }, []);

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
    setIsDraggingRef(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void onReferenceFile(f);
  };

  const handleGenerate = async () => {
    if (!dishReference) {
      setError('Wgraj zdjęcie dania (krok 1).');
      return;
    }
    if (!style) {
      setError('Wybierz styl zdjęcia (krok 2).');
      return;
    }
    if (hasNoCredits) {
      setError('Brak kredytów. Przejdź na plan Premium, aby kontynuować.');
      return;
    }
    setError(null);
    setIsGenerating(true);
    try {
      const result: GenerationResult = await enhanceDishImage(
        dishReference,
        currentEnhanceSettings
      );
      let img = result.image;
      if (isFreeTrialOver) img = await addFreeWatermark(img);
      setGeneratedImages((prev) => {
        const next = [img, ...prev];
        return next.slice(0, MAX_ENHANCE_PREVIEWS);
      });
      if (result.creditsRemaining !== undefined) onCreditsUpdated?.(result.creditsRemaining);
      onGenerationSuccess?.();
    } catch (err: any) {
      setError(err?.message || 'Błąd wizualizacji.');
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

  const removeGeneratedImage = (indexToRemove: number) => {
    setGeneratedImages((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleQuickAddOriginal = () => {
    if (!dishReference) {
      setError('Najpierw wgraj zdjęcie dania (krok 1).');
      return;
    }
    setError(null);
    setSaveTargetImage(dishReference);
    setSaveDishName('');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24">
      {/* Header */}
      <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-indigo-50 text-indigo-600 rounded-3xl">
            <Palette size={28} />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight italic">Studio zdjęć</h2>
            <p className="text-xs text-slate-500 mt-1">Ulepszanie prawdziwych zdjęć dań — krok po kroku.</p>
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
              <p className="text-xs opacity-60">Aby dalej ulepszać zdjęcia, przejdź na plan Premium.</p>
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

      {isFreeTrialOver && !hasNoCredits && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-[30px] flex items-center gap-4 text-white">
          <Crown className="text-amber-500" />
          <div>
            <p className="font-black">Tryb Free – Znak Wodny</p>
            <p className="text-xs opacity-60">Wykorzystałeś limit. Zdjęcia będą miały logo Chefvision.</p>
          </div>
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

      {/* 2-col layout: Controls (left) + Preview (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ───── LEFT: controls ───── */}
        <div className="space-y-5">
          {/* Step 1 — Upload */}
          <div className={STEP_CARD_CLS}>
            <StepHeader n={1} title="Wgraj zdjęcie dania" required />
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
                  <p className="text-sm font-bold text-slate-800">Zdjęcie gotowe do ulepszenia</p>
                  <p className="text-xs text-slate-500">Przejdź do kroku 2 — wybierz styl.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDishReference(null);
                  }}
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
                  setIsDraggingRef(true);
                }}
                onDragLeave={() => setIsDraggingRef(false)}
                onDrop={handleReferenceDrop}
                className={`block border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-colors ${
                  isDraggingRef ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleReferenceInput}
                />
                <div className="flex flex-col items-center gap-3 text-slate-500">
                  {isUploadingRef ? <Loader2 className="animate-spin" size={28} /> : <Upload size={28} />}
                  <p className="text-sm font-bold text-slate-700">Przeciągnij zdjęcie lub kliknij, aby wybrać</p>
                  <p className="text-xs text-slate-400">JPG / PNG / WEBP · do 1 MB (kompresujemy automatycznie)</p>
                </div>
              </label>
            )}
          </div>

          {/* Step 2 — Style (required): kwadratowe karty ze zdjęciem + etykieta */}
          <div className={STEP_CARD_CLS}>
            <StepHeader n={2} title="Wybierz styl zdjęcia" required />
            <div
              ref={styleScrollerRef}
              className="flex gap-3 overflow-x-auto pb-1 pt-0.5 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {ENHANCE_STYLES.map((opt) => (
                <div key={opt.id} className="shrink-0 snap-center">
                  <EnhanceStyleCard option={opt} active={style === opt.id} onSelect={() => setStyle(opt.id)} />
                </div>
              ))}
              <div className="shrink-0 snap-center">
                <QuickAddOriginalCard disabled={!dishReference} onClick={handleQuickAddOriginal} />
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={styleScrollValue}
              onChange={(e) => {
                const nextValue = Number(e.target.value);
                setStyleScrollValue(nextValue);
                const scroller = styleScrollerRef.current;
                if (!scroller) return;
                const maxScrollLeft = Math.max(scroller.scrollWidth - scroller.clientWidth, 0);
                scroller.scrollTo({ left: (nextValue / 100) * maxScrollLeft, behavior: 'smooth' });
              }}
              disabled={!hasStyleOverflow}
              className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 disabled:cursor-default disabled:opacity-60 [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-slate-200 [&::-webkit-slider-thumb]:-mt-1 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-7 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-md [&::-webkit-slider-thumb]:bg-orange-500 [&::-webkit-slider-thumb]:shadow-sm [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-slate-200 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-7 [&::-moz-range-thumb]:rounded-md [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-orange-500"
              aria-label="Przewijaj style zdjęcia"
            />
          </div>

          {/* Generate button */}
          <button
            onClick={() => void handleGenerate()}
            disabled={!canGenerate}
            className="w-full py-5 bg-chef-dark text-white rounded-[28px] font-black text-lg flex items-center justify-center gap-3 shadow-xl hover:bg-chef-dark2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? <Loader2 className="animate-spin" size={22} /> : <Wand2 size={22} />}
            {isGenerating ? 'ULEPSZAM...' : hasNoCredits ? 'BRAK KREDYTÓW' : 'ULEPSZ ZDJĘCIE'}
          </button>
        </div>

        {/* ───── RIGHT: preview ───── */}
        <div className="space-y-4">
          <div className="bg-white border border-slate-100 rounded-[32px] p-6 shadow-sm sticky top-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black tracking-tight text-slate-800 flex items-center gap-2">
                <Sparkles size={16} className="text-amber-500" /> Podgląd ({generatedImages.length}/{MAX_ENHANCE_PREVIEWS})
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
                <p className="text-sm font-bold text-slate-500">Tutaj pojawi się ulepszone zdjęcie</p>
                <p className="text-xs mt-1">Każde kolejne kliknięcie „Ulepsz zdjęcie” doda wariant (max {MAX_ENHANCE_PREVIEWS}).</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {generatedImages.map((src, idx) => (
                  <div key={idx} className="group relative rounded-2xl overflow-hidden border border-slate-100">
                    <button
                      type="button"
                      onClick={() => removeGeneratedImage(idx)}
                      className="absolute top-2 right-2 z-10 p-2 rounded-lg bg-black/65 text-white hover:bg-red-600 transition-colors"
                      title="Usuń zdjęcie"
                      aria-label="Usuń zdjęcie"
                    >
                      <Trash2 size={16} />
                    </button>
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

    </div>
  );
};
