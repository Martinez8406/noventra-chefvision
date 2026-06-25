import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
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
import { GeneratorParams, UserTokens } from '../types';
import { formatTokenStatusI18n } from '../utils/formatTokenStatusI18n';
import { WatermarkWrapper } from './WatermarkWrapper';
import {
  AlertCircle,
  CheckCircle,
  Crown,
  Gift,
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
  RotateCcw,
  X,
} from 'lucide-react';

interface Props {
  onSaveStandard: (imageUrl: string, params: GeneratorParams) => void;
  hasProFeatures: boolean;
  subscriptionStatus?: 'trial' | 'premium' | 'free_limited';
  trialEndsAt?: string | null;
  generationsUsed: number;
  credits: number;
  tokens?: UserTokens;
  onGenerationSuccess?: () => void;
  onCreditsUpdated?: (
    credits: number,
    tokens?: { trial: number; subscription: number; extra: number; total: number }
  ) => void;
  onRequestPremium?: () => void;
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
  label,
  active,
  onSelect,
}: {
  option: (typeof ENHANCE_STYLES)[number];
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      title={label}
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
        {label}
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
  const { t } = useTranslation('studio');

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? t('quickAdd.disabledTitle') : t('quickAdd.enabledTitle')}
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
          {t('quickAdd.noAi')}
        </span>
        <span className="text-[13px] font-black leading-tight tracking-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)]">
          {t('quickAdd.titleLine1')}
          <br />
          {t('quickAdd.titleLine2')}
        </span>
      </div>
    </button>
  );
}

export const ChefsStudio: React.FC<Props> = ({
  onSaveStandard,
  hasProFeatures,
  subscriptionStatus = 'trial',
  trialEndsAt,
  generationsUsed,
  credits,
  tokens,
  onGenerationSuccess,
  onCreditsUpdated,
  onRequestPremium,
}) => {
  const { t } = useTranslation('studio');
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

  const showWatermark = !hasProFeatures;
  const isFree = subscriptionStatus === 'free_limited';
  const isTrial = subscriptionStatus === 'trial';
  const canUseAi = !isFree && credits > 0;
  const hasNoCredits = !canUseAi;
  const tokenLabel = formatTokenStatusI18n(subscriptionStatus, credits, tokens, trialEndsAt);
  const canGenerate = canUseAi && !!dishReference && !!style && !isGenerating;
  const latestGeneratedImage = generatedImages[0] ?? null;

  const currentEnhanceSettings: EnhanceSettings = useMemo(
    () => ({
      style: style ?? undefined,
    }),
    [style]
  );

  const isStyleSliderDraggingRef = useRef(false);

  useEffect(() => {
    const scroller = styleScrollerRef.current;
    if (!scroller) return;

    const syncScrollState = () => {
      const maxScrollLeft = Math.max(scroller.scrollWidth - scroller.clientWidth, 0);
      const hasOverflow = maxScrollLeft > 1;
      setHasStyleOverflow(hasOverflow);
      if (!isStyleSliderDraggingRef.current) {
        setStyleScrollValue(maxScrollLeft === 0 ? 0 : (scroller.scrollLeft / maxScrollLeft) * 100);
      }
    };

    syncScrollState();
    scroller.addEventListener('scroll', syncScrollState, { passive: true });
    window.addEventListener('resize', syncScrollState);

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncScrollState) : null;
    ro?.observe(scroller);
    for (const child of scroller.children) {
      ro?.observe(child);
    }

    return () => {
      scroller.removeEventListener('scroll', syncScrollState);
      window.removeEventListener('resize', syncScrollState);
      ro?.disconnect();
    };
  }, []);

  const handleStyleSlider = (nextValue: number) => {
    setStyleScrollValue(nextValue);
    const scroller = styleScrollerRef.current;
    if (!scroller) return;
    const maxScrollLeft = Math.max(scroller.scrollWidth - scroller.clientWidth, 0);
    scroller.scrollTo({ left: (nextValue / 100) * maxScrollLeft, behavior: 'auto' });
  };

  const onReferenceFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setIsUploadingRef(true);
    setError(null);
    try {
      const dataUrl = await compressImageForUpload(file);
      setDishReference(dataUrl);
    } catch (e: any) {
      setError(e?.message || t('errors.imageProcessing'));
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
    if (isGenerating) return;
    if (!dishReference) {
      setError(t('errors.uploadDishStep1'));
      return;
    }
    if (!style) {
      setError(t('errors.selectStyleStep2'));
      return;
    }
    if (isFree) {
      onRequestPremium?.();
      return;
    }
    if (!canUseAi) {
      setError(t('errors.noTrialTokens'));
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
      if (showWatermark) img = await addFreeWatermark(img);
      setGeneratedImages((prev) => {
        const next = [img, ...prev];
        return next.slice(0, MAX_ENHANCE_PREVIEWS);
      });
      if (result.creditsRemaining !== undefined) {
        onCreditsUpdated?.(result.creditsRemaining, result.tokens);
      }
      onGenerationSuccess?.();
    } catch (err: any) {
      setError(err?.message || t('errors.visualization'));
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
    const outcome = await shareImageViaSystem(shareTargetImage, t('shareDishName'));
    if (outcome === 'shared' || outcome === 'cancelled') {
      setShareTargetImage(null);
      return;
    }
    alert(t('errors.shareUnavailable'));
  };

  const removeGeneratedImage = (indexToRemove: number) => {
    setGeneratedImages((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleQuickAddOriginal = () => {
    if (!dishReference) {
      setError(t('errors.uploadFirstStep1'));
      return;
    }
    setError(null);
    setSaveTargetImage(dishReference);
    setSaveDishName('');
  };

  return (
    <div className="max-w-7xl mx-auto min-w-0 space-y-8 pb-24">
      {/* Header */}
      <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-indigo-50 text-indigo-600 rounded-3xl">
            <Palette size={28} />
          </div>
        </div>
        <div className="text-[10px] font-black uppercase tracking-widest">
          <span className={hasNoCredits ? 'text-red-500' : 'text-slate-400'}>{tokenLabel}</span>
        </div>
      </div>

      {isFree && (
        <div className="bg-slate-100 border border-slate-200 p-6 rounded-[30px] flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-slate-800">
          <div className="flex items-center gap-4">
            <AlertCircle className="text-slate-500 shrink-0" />
            <div>
              <p className="font-black">{t('freePlan.title')}</p>
              <p className="text-xs text-slate-600 mt-1">
                {t('freePlan.description')}
              </p>
            </div>
          </div>
          <button type="button" onClick={onRequestPremium} className="bg-gradient-to-r from-emerald-400 to-green-500 text-[#0a1a12] px-6 py-3 rounded-2xl font-black text-sm shrink-0 shadow-[0_0_16px_rgba(52,211,153,0.35)]">
            {t('freePlan.unlockPremium')}
          </button>
        </div>
      )}

      {isTrial && !canUseAi && (
        <div className="bg-amber-500/10 border border-amber-500/20 p-6 rounded-[30px] flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-slate-800">
          <div>
            <p className="font-black">{t('trial.noTokensTitle')}</p>
            <p className="text-xs text-slate-600 mt-1">
              {t('trial.noTokensDescription')}
            </p>
          </div>
          <button type="button" onClick={onRequestPremium} className="bg-gradient-to-r from-emerald-400 to-green-500 text-[#0a1a12] px-5 py-2.5 rounded-2xl font-black text-sm shrink-0">
            {t('freePlan.unlockPremium')}
          </button>
        </div>
      )}

      {isTrial && canUseAi && (
        <div className="bg-blue-500/10 border border-blue-500/20 p-6 rounded-[30px] flex items-center gap-4 text-slate-800">
          <Gift className="text-blue-600 shrink-0" />
          <div>
            <p className="font-black">{t('trial.activeTitle')}</p>
            <p className="text-xs text-slate-600 mt-1">
              {t('trial.activeDescription')}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800">
          <AlertCircle className="shrink-0 mt-0.5" size={20} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold">{t('errorTitle')}</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
          <button type="button" onClick={() => setError(null)} className="p-1 rounded-lg hover:bg-red-100 text-red-600">
            <X size={18} />
          </button>
        </div>
      )}

      {/* 2-col layout: Controls (left) + Preview (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 min-w-0">
        {/* ───── LEFT: controls ───── */}
        <div className="space-y-5 min-w-0">
          {/* Step 1 — Upload */}
          <div className={STEP_CARD_CLS}>
            <StepHeader n={1} title={t('steps.uploadDish')} required />
            <input
              ref={dishRefInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleReferenceInput}
            />
            {dishReference ? (
              <div className="flex items-center gap-4 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <img src={dishReference} alt={t('upload.uploadedAlt')} className="w-20 h-20 object-cover rounded-xl" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800">{t('upload.readyTitle')}</p>
                  <p className="text-xs text-slate-500">
                    {isFree || !canUseAi
                      ? t('upload.readyFreeHint')
                      : t('upload.readyNextStep')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDishReference(null);
                  }}
                  className="p-2 rounded-xl text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                  aria-label={t('upload.removePhoto')}
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
                  <p className="text-sm font-bold text-slate-700">{t('upload.dropzoneTitle')}</p>
                  <p className="text-xs text-slate-400">{t('upload.dropzoneHint')}</p>
                </div>
              </label>
            )}
          </div>

          {/* Step 2 — Style (required): kwadratowe karty ze zdjęciem + etykieta */}
          <div className={`${STEP_CARD_CLS} min-w-0 overflow-hidden`}>
            <StepHeader n={2} title={t('steps.selectStyle')} required />
            <div
              ref={styleScrollerRef}
              className="flex w-full min-w-0 max-w-full gap-3 overflow-x-auto overscroll-x-contain pb-1 pt-0.5 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {ENHANCE_STYLES.map((opt) => (
                <div key={opt.id} className="shrink-0 snap-center">
                  <EnhanceStyleCard
                    option={opt}
                    label={t(`styles.${opt.id}`)}
                    active={style === opt.id}
                    onSelect={() => setStyle(opt.id)}
                  />
                </div>
              ))}
              <div className="shrink-0 snap-center">
                <QuickAddOriginalCard disabled={!dishReference} onClick={handleQuickAddOriginal} />
              </div>
            </div>
            {hasStyleOverflow && (
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={styleScrollValue}
                onPointerDown={() => {
                  isStyleSliderDraggingRef.current = true;
                }}
                onPointerUp={() => {
                  isStyleSliderDraggingRef.current = false;
                }}
                onPointerCancel={() => {
                  isStyleSliderDraggingRef.current = false;
                }}
                onInput={(e) => handleStyleSlider(Number(e.currentTarget.value))}
                onChange={(e) => handleStyleSlider(Number(e.target.value))}
                className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-slate-200 [&::-webkit-slider-thumb]:-mt-1 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-7 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-md [&::-webkit-slider-thumb]:bg-orange-500 [&::-webkit-slider-thumb]:shadow-sm [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-slate-200 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-7 [&::-moz-range-thumb]:rounded-md [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-orange-500"
                aria-label={t('styles.scrollAria')}
              />
            )}
          </div>

          {/* Generate button */}
          <button
            type="button"
            onClick={() => {
              if (isFree) {
                onRequestPremium?.();
                return;
              }
              void handleGenerate();
            }}
            disabled={isGenerating || (!isFree && !canGenerate)}
            className={`w-full py-5 rounded-[28px] font-black text-lg flex items-center justify-center gap-3 shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              isFree
                ? 'bg-gradient-to-r from-emerald-400 to-green-500 text-[#0a1a12] shadow-[0_0_24px_rgba(52,211,153,0.35)] hover:from-emerald-300 hover:to-green-400'
                : 'bg-chef-dark text-white hover:bg-chef-dark2'
            }`}
          >
            {isGenerating ? <Loader2 className="animate-spin" size={22} /> : <Wand2 size={22} />}
            {isGenerating
              ? t('generate.enhancing')
              : isFree
                ? t('generate.unlockPremium')
                : !canUseAi
                  ? t('generate.noTrialTokens')
                  : t('generate.enhance')}
          </button>
        </div>

        {/* ───── RIGHT: preview ───── */}
        <div className="space-y-4 min-w-0">
          <div className="bg-white border border-slate-100 rounded-[32px] p-6 shadow-sm sticky top-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black tracking-tight text-slate-800 flex items-center gap-2">
                <Sparkles size={16} className="text-amber-500" /> {t('preview.title', { count: generatedImages.length, max: MAX_ENHANCE_PREVIEWS })}
              </h4>
              {generatedImages.length > 0 && (
                <button
                  type="button"
                  onClick={() => setGeneratedImages([])}
                  className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-700"
                >
                  {t('preview.clear')}
                </button>
              )}
            </div>
            {generatedImages.length === 0 ? (
              <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 min-h-[360px] flex flex-col items-center justify-center text-center p-8 text-slate-400">
                <ImageIcon size={40} className="mb-3" />
                <p className="text-sm font-bold text-slate-500">{t('preview.emptyTitle')}</p>
                <p className="text-xs mt-1">{t('preview.emptyHint', { max: MAX_ENHANCE_PREVIEWS })}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {generatedImages.map((src, idx) => (
                  <div key={idx} className="group relative rounded-2xl overflow-hidden border border-slate-100">
                    <button
                      type="button"
                      onClick={() => removeGeneratedImage(idx)}
                      className="absolute top-2 right-2 z-10 p-2 rounded-lg bg-black/65 text-white hover:bg-red-600 transition-colors"
                      title={t('preview.removeImage')}
                      aria-label={t('preview.removeImage')}
                    >
                      <Trash2 size={16} />
                    </button>
                    <WatermarkWrapper show={showWatermark} className="">
                      <img src={src} alt={t('preview.variantAlt')} className="w-full h-auto block" />
                    </WatermarkWrapper>
                    <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => downloadDataUrl(src, `${safeImageFileBase('danie')}-${idx + 1}.png`)}
                        className="p-2 rounded-lg bg-white/90 text-slate-800 hover:bg-white"
                        title={t('preview.download')}
                      >
                        <Download size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setShareTargetImage(src)}
                        className="p-2 rounded-lg bg-white/90 text-slate-800 hover:bg-white"
                        title={t('preview.share')}
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
                        title={t('preview.saveToMenu')}
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

      {latestGeneratedImage && !isGenerating && (
        <div className="sticky bottom-4 z-30 flex flex-col sm:flex-row gap-3 p-4 sm:p-5 bg-white rounded-[28px] border border-slate-200 shadow-[0_8px_40px_rgba(0,0,0,0.12)]">
          <button
            type="button"
            onClick={() => {
              setSaveTargetImage(latestGeneratedImage);
              setSaveDishName('');
            }}
            className="flex-1 py-4 px-6 rounded-2xl bg-chef-gold text-white font-black text-sm sm:text-base flex items-center justify-center gap-2 hover:bg-chef-gold2 transition-colors shadow-md"
          >
            <Save size={20} />
            {t('stickyBar.saveToMenu')}
          </button>
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={!canGenerate}
            className="flex-1 py-4 px-6 rounded-2xl bg-chef-dark text-white font-black text-sm sm:text-base flex items-center justify-center gap-2 hover:bg-chef-dark2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
          >
            <RotateCcw size={20} />
            {t('stickyBar.tryAgain')}
          </button>
        </div>
      )}

      {/* Save-to-menu modal */}
      {saveTargetImage && (
        <div className="fixed inset-0 z-[400] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-start gap-3">
              <h3 className="text-lg font-black text-slate-900">{t('saveModal.title')}</h3>
              <button
                type="button"
                onClick={() => setSaveTargetImage(null)}
                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"
                aria-label={t('saveModal.close')}
              >
                <X size={18} />
              </button>
            </div>
            <img src={saveTargetImage} alt={t('saveModal.previewAlt')} className="w-full aspect-[4/3] object-cover rounded-2xl" />
            <label className="block space-y-2">
              <span className={STEP_LABEL_CLS}>{t('saveModal.dishName')}</span>
              <input
                type="text"
                autoFocus
                value={saveDishName}
                onChange={(e) => setSaveDishName(e.target.value)}
                placeholder={t('saveModal.dishNamePlaceholder')}
                className="w-full px-4 py-3 border-2 border-slate-100 focus:ring-4 focus:ring-chef-beige/40 rounded-2xl outline-none text-slate-700"
              />
            </label>
            <button
              type="button"
              onClick={confirmSaveToMenu}
              disabled={!saveDishName.trim()}
              className="w-full py-4 bg-chef-gold text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-chef-gold2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle size={18} /> {t('saveModal.save')}
            </button>
          </div>
        </div>
      )}

      {/* Share modal */}
      {shareTargetImage && (
        <div className="fixed inset-0 z-[500] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-[28px] w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-start">
              <h3 className="text-lg font-black text-slate-900">{t('shareModal.title')}</h3>
              <button
                type="button"
                onClick={() => setShareTargetImage(null)}
                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"
                aria-label={t('shareModal.close')}
              >
                <X size={18} />
              </button>
            </div>
            <img src={shareTargetImage} alt={t('shareModal.previewAlt')} className="w-full aspect-[4/3] object-cover rounded-2xl" />
            <button
              type="button"
              onClick={() => void shareImage()}
              className="w-full py-4 rounded-2xl bg-chef-dark text-white font-black text-sm flex items-center justify-center gap-2 hover:bg-chef-dark2 transition-colors"
            >
              <Share2 size={18} /> {t('shareModal.shareSystem')}
            </button>
            <button
              type="button"
              onClick={() => {
                downloadDataUrl(shareTargetImage, `${safeImageFileBase('danie')}.png`);
              }}
              className="w-full py-4 rounded-2xl border-2 border-slate-200 text-slate-800 font-black text-sm flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors"
            >
              <Download size={18} /> {t('shareModal.downloadFile')}
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
