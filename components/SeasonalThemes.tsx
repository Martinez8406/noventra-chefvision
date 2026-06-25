import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
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
import { GeneratorParams, UserTokens } from '../types';
import { formatTokenStatusI18n } from '../utils/formatTokenStatusI18n';
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
  hasProFeatures: boolean;
  subscriptionStatus?: 'trial' | 'premium' | 'free_limited';
  trialEndsAt?: string | null;
  generationsUsed: number;
  credits: number;
  tokens?: UserTokens;
  savedBackdrops?: Backdrop[];
  onGenerationSuccess?: () => void;
  onCreditsUpdated?: (
    credits: number,
    tokens?: { trial: number; subscription: number; extra: number; total: number }
  ) => void;
  onRequestPremium?: () => void;
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
  hasProFeatures,
  subscriptionStatus = 'trial',
  trialEndsAt,
  generationsUsed,
  credits,
  tokens,
  savedBackdrops = [],
  onGenerationSuccess,
  onCreditsUpdated,
  onRequestPremium,
}) => {
  const { t } = useTranslation('themes');
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

  const showWatermark = !hasProFeatures;
  const isFree = subscriptionStatus === 'free_limited';
  const canUseAi = !isFree && credits > 0;
  const hasNoCredits = !canUseAi;
  const tokenLabel = formatTokenStatusI18n(subscriptionStatus, credits, tokens, trialEndsAt);
  const hasThemeSelected = !!theme || !!customThemeImage;
  const canGenerate = canUseAi && !!dishReference && hasThemeSelected && !isGenerating;

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
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void onReferenceFile(f);
  };

  const handleGenerate = async () => {
    if (!dishReference) {
      setError(t('errors.uploadDishStep1'));
      return;
    }
    if (!theme && !customThemeImage) {
      setError(t('errors.selectThemeStep2'));
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
      const result: GenerationResult = await enhanceDishImage(dishReference, {
        theme: customThemeImage ? undefined : theme ?? undefined,
        customThemeImage: customThemeImage ?? undefined,
      });
      let img = result.image;
      if (showWatermark) img = await addFreeWatermark(img);
      setGeneratedImages((prev) => [img, ...prev].slice(0, MAX_ENHANCE_PREVIEWS));
      if (result.creditsRemaining !== undefined) {
        onCreditsUpdated?.(result.creditsRemaining, result.tokens);
      }
      onGenerationSuccess?.();
    } catch (err: any) {
      setError(err?.message || t('errors.generation'));
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

  const onCustomThemeFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setError(null);
    try {
      const dataUrl = await compressImageForUpload(file);
      setTheme(null);
      setCustomThemeImage(dataUrl);
      setCustomThemeLabel(file.name || t('customTheme.defaultName'));
    } catch (e: any) {
      setError(e?.message || t('errors.themeLoad'));
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
      if (!response.ok) throw new Error(t('errors.studioFetch'));
      const blob = await response.blob();
      const ext = blob.type.includes('png') ? 'png' : 'jpg';
      const file = new File([blob], `studio-backdrop.${ext}`, { type: blob.type || 'image/jpeg' });
      const dataUrl = await compressImageForUpload(file);

      setTheme(null);
      setCustomThemeImage(dataUrl);
      setCustomThemeLabel(t('customTheme.fromStudio'));
      setIsPickingStudioTheme(false);
    } catch (e: any) {
      setError(e?.message || t('errors.studioUse'));
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
            <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight italic">{t('title')}</h2>
            <p className="text-xs text-slate-500 mt-1">{t('subtitle')}</p>
          </div>
        </div>
        <div className="text-[10px] font-black uppercase tracking-widest">
          <span className={hasNoCredits ? 'text-red-500' : 'text-slate-400'}>{tokenLabel}</span>
        </div>
      </div>

      {isFree && (
        <div className="bg-slate-100 border border-slate-200 p-6 rounded-[30px] text-slate-800">
          <p className="font-black">{t('freePlan.title')}</p>
          <p className="text-xs text-slate-600 mt-1">{t('freePlan.description')}</p>
        </div>
      )}

      {hasNoCredits && !isFree && (
        <div className="bg-slate-900 border border-amber-500/30 p-6 rounded-[30px] flex items-center justify-between text-white">
          <div className="flex items-center gap-4">
            <Crown className="text-amber-500" />
            <div>
              <p className="font-black">{t('noTokens.title')}</p>
              <p className="text-xs opacity-60">{t('noTokens.description')}</p>
            </div>
          </div>
          <button
            onClick={onRequestPremium}
            className="bg-amber-500 text-slate-900 px-6 py-3 rounded-2xl font-black text-sm hover:bg-amber-400 transition-colors"
          >
            {t('noTokens.cta')}
          </button>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* LEFT: controls */}
        <div className="space-y-5">
          {/* Step 1 — Upload */}
          <div className={STEP_CARD_CLS}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black bg-slate-900 text-white">1</div>
              <h4 className="text-sm font-black tracking-tight text-slate-800">
                {t('steps.uploadDish')} <span className="text-red-500">*</span>
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
                <img src={dishReference} alt={t('upload.uploadedAlt')} className="w-20 h-20 object-cover rounded-xl" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800">{t('upload.readyTitle')}</p>
                  <p className="text-xs text-slate-500">{t('upload.readyHint')}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDishReference(null)}
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
                  <p className="text-sm font-bold text-slate-700">{t('upload.dropzoneTitle')}</p>
                  <p className="text-xs text-slate-400">{t('upload.dropzoneHint')}</p>
                </div>
              </label>
            )}
          </div>

          {/* Step 2 — Theme (required) */}
          <div className={STEP_CARD_CLS}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black bg-slate-900 text-white">2</div>
              <h4 className="text-sm font-black tracking-tight text-slate-800">
                {t('steps.selectTheme')} <span className="text-red-500">*</span>
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
                        alt={t(`themes.${opt.id}`)}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    )}
                    <span className="relative z-10 drop-shadow-md">{t(`themes.${opt.id}`)}</span>
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
                    alt={t('customTheme.alt')}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                )}
                <span className="relative z-10 drop-shadow-md flex items-center gap-2">
                  <Plus size={14} /> {t('customTheme.label')}
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
                  <img src={customThemeImage} alt={t('customTheme.alt')} className="w-12 h-12 rounded-lg object-cover" />
                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-800 truncate">{t('customTheme.activeTitle')}</p>
                    <p className="text-[11px] text-slate-500 truncate">{customThemeLabel || t('customTheme.manualPick')}</p>
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
                  {t('customTheme.clear')}
                </button>
              </div>
            )}
            <p className="text-[11px] text-slate-400 leading-snug">{t('customTheme.hint')}</p>
          </div>

          {/* Generate */}
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
              ? t('generate.creating')
              : isFree
                ? t('generate.unlockPremium')
                : hasNoCredits
                  ? t('generate.noTokens')
                  : t('generate.generate')}
          </button>
        </div>

        {/* RIGHT: preview */}
        <div className="space-y-4">
          <div className="bg-white border border-slate-100 rounded-[32px] p-6 shadow-sm sticky top-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black tracking-tight text-slate-800 flex items-center gap-2">
                <Sparkles size={16} className="text-rose-500" /> {t('preview.title', { count: generatedImages.length, max: MAX_ENHANCE_PREVIEWS })}
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

      {isPickingStudioTheme && (
        <div className="fixed inset-0 z-[520] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] w-full max-w-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">{t('studioPicker.title')}</h3>
              <button
                type="button"
                onClick={() => setIsPickingStudioTheme(false)}
                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"
                aria-label={t('studioPicker.close')}
              >
                <X size={18} />
              </button>
            </div>
            {savedBackdrops.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                {t('studioPicker.empty')}
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
                    <img src={bg.imageUrl} alt={t('studioPicker.backdropAlt')} className="w-full aspect-[4/3] object-cover group-hover:scale-[1.02] transition-transform" />
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
              <h3 className="text-lg font-black text-slate-900">{t('customTheme.modalTitle')}</h3>
              <button
                type="button"
                onClick={() => setIsCustomThemeMenuOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"
                aria-label={t('shareModal.close')}
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
              <Upload size={16} /> {t('customTheme.fromDisk')}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCustomThemeMenuOpen(false);
                setIsPickingStudioTheme(true);
              }}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-black text-slate-800 hover:bg-slate-100 flex items-center justify-center gap-2"
            >
              <Plus size={16} /> {t('customTheme.fromStudio')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
