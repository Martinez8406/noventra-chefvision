
import React, { useState, useRef, useEffect } from 'react';
import { LIGHTING_OPTIONS, PLATE_OPTIONS, ANGLE_OPTIONS, STYLE_OPTIONS } from '../constants';
import { generateDishImageWithAI, AiDishSettings, GenerationResult } from '../services/aiService';
import { compressImageForUpload } from '../services/imageService';
import { GeneratorParams, Backdrop } from '../types';
import { WatermarkWrapper } from './WatermarkWrapper';
import { 
  Loader2, 
  Wand2, 
  CheckCircle, 
  Palette, 
  Sparkles, 
  Layout, 
  Sun, 
  Moon, 
  UtensilsCrossed, 
  ChevronRight, 
  Camera, 
  X,
  RefreshCw,
  Mic,
  MicOff,
  AlertCircle,
  Layers,
  Lock,
  Crown
} from 'lucide-react';

interface Props {
  onSaveStandard: (imageUrl: string, params: GeneratorParams) => void;
  savedBackdrops: Backdrop[];
  isSubscribed: boolean;
  generationsUsed: number;
  credits: number;
  /** Wywoływane po udanej generacji (odjęcie 1 kredytu po stronie backendu). */
  onGenerationSuccess?: () => void;
  onCreditsUpdated?: (credits: number) => void;
  /** Przekierowanie do Stripe – Kup Premium */
  onBuyPremium?: () => void;
}

export const ChefsStudio: React.FC<Props> = ({ onSaveStandard, savedBackdrops, isSubscribed, generationsUsed, credits, onGenerationSuccess, onCreditsUpdated, onBuyPremium }) => {
  const [params, setParams] = useState<GeneratorParams>({
    dishName: '',
    lighting: LIGHTING_OPTIONS[0].value,
    plateType: PLATE_OPTIONS[0].value,
    cameraAngle: ANGLE_OPTIONS[0].value,
    style: STYLE_OPTIONS[0].value,
  });

  const [advancedSettingsOpen, setAdvancedSettingsOpen] = useState(false);
  const [dishReferenceImage, setDishReferenceImage] = useState<string | null>(null);
  const [ingredientsText, setIngredientsText] = useState('');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [customBaseImage, setCustomBaseImage] = useState<string | null>(null);
  const [customTablewareImage, setCustomTablewareImage] = useState<string | null>(null);
  const [isBackdropSelectorOpen, setIsBackdropSelectorOpen] = useState(false);
  const [isUploadingCustom, setIsUploadingCustom] = useState(false);
  const [isUploadingDishRef, setIsUploadingDishRef] = useState(false);
  const tablewareInputRef = useRef<HTMLInputElement>(null);
  const dishRefInputRef = useRef<HTMLInputElement>(null);

  const isFreeTrialOver = !isSubscribed && generationsUsed >= 5;
  const hasNoCredits = !isSubscribed && credits <= 0;
  const hybridModeActive = !!dishReferenceImage;
  const bistroLifestyleValue = STYLE_OPTIONS.find((o) => o.label === 'Bistro Lifestyle')?.value;
  const isBistroLifestyle = !!bistroLifestyleValue && params.style === bistroLifestyleValue;

  const streetFoodValue = STYLE_OPTIONS.find((o) => o.label === 'Street Food')?.value;
  const isStreetFood = !!streetFoodValue && params.style === streetFoodValue;

  const bistroDefaultLightingValue =
    LIGHTING_OPTIONS.find((o) => o.label === 'Naturalne')?.value ?? LIGHTING_OPTIONS[0].value;
  const bistroDefaultPlateValue =
    PLATE_OPTIONS.find((o) => o.label === 'Biała Porcelana')?.value ?? PLATE_OPTIONS[0].value;
  const streetFoodDefaultPlateValue =
    PLATE_OPTIONS.find((o) => o.label === 'Ceramika')?.value ?? PLATE_OPTIONS[0].value;
  const bistroLifestyleTooltipText =
    'Styl Bistro Lifestyle wymaga jasnych tła dla zachowania estetyki premium.';

  useEffect(() => {
    if (hybridModeActive) setAdvancedSettingsOpen(false);
  }, [hybridModeActive]);

  // Style Logic: auto-override lighting + podłoże dla Bistro Lifestyle.
  useEffect(() => {
    if (!isBistroLifestyle) return;
    setParams((prev) => ({
      ...prev,
      lighting: bistroDefaultLightingValue,
      plateType: bistroDefaultPlateValue,
    }));
  }, [isBistroLifestyle, bistroDefaultLightingValue, bistroDefaultPlateValue]);

  // Style Logic (UI-only): Street Food blokuje ciemne tekstury i białą porcelanę.
  useEffect(() => {
    if (!isStreetFood) return;

    const disabledPlateValues = new Set(
      PLATE_OPTIONS.filter((opt) => {
        const label = opt.label.toLowerCase();
        const value = String(opt.value).toLowerCase();
        const isKamienLup = value.includes('stone') || label.includes('kamień') || label.includes('łupek') || value.includes('dark');
        const isBialaPorcelana = label.includes('biała porcelana') || value.includes('porcelain');
        return isKamienLup || isBialaPorcelana;
      }).map((opt) => opt.value)
    );

    setParams((prev) => {
      if (!disabledPlateValues.has(prev.plateType)) return prev;
      return { ...prev, plateType: streetFoodDefaultPlateValue };
    });
  }, [isStreetFood, streetFoodDefaultPlateValue]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const addWatermark = (dataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(dataUrl);

        ctx.drawImage(img, 0, 0);
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(-Math.PI / 4);
        ctx.font = 'bold 80px Inter, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.textAlign = 'center';
        for(let i = -5; i < 5; i++) {
          for(let j = -5; j < 5; j++) ctx.fillText('CHEFVISION', i * 600, j * 300);
        }
        ctx.restore();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
        ctx.fillRect(canvas.width - 400, canvas.height - 80, 400, 80);
        ctx.font = 'bold 24px Inter, sans-serif';
        ctx.fillStyle = '#FBB02D';
        ctx.fillText('STWORZONE W CHEFVISION FREE', canvas.width - 380, canvas.height - 35);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = dataUrl;
    });
  };

  /** Simple mode uses Chefvision Default / Auto; advanced uses current params. */
  const getEffectiveParams = (): GeneratorParams => {
    if (advancedSettingsOpen) return params;
    return {
      ...params,
      style: STYLE_OPTIONS[0].value,
      lighting: LIGHTING_OPTIONS[0].value,
      plateType: PLATE_OPTIONS[0].value,
      cameraAngle: ANGLE_OPTIONS[0].value,
    };
  };

  const buildAiSettings = (effectiveParams: GeneratorParams): AiDishSettings => {
    const styleLabel = STYLE_OPTIONS.find(o => o.value === effectiveParams.style)?.label || effectiveParams.style;
    const lightingLabel = LIGHTING_OPTIONS.find(o => o.value === effectiveParams.lighting)?.label || effectiveParams.lighting;
    const plateLabel = PLATE_OPTIONS.find(o => o.value === effectiveParams.plateType)?.label || effectiveParams.plateType;
    const angleLabel = ANGLE_OPTIONS.find(o => o.value === effectiveParams.cameraAngle)?.label || effectiveParams.cameraAngle;

    return {
      dishName: effectiveParams.dishName,
      styleLabel,
      lightingLabel,
      plateLabel,
      angleLabel,
      hasCustomBackdrop: !!customBaseImage,
      hasCustomTableware: !!customTablewareImage,
    };
  };

  const handleTablewareFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => setCustomTablewareImage(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCustomPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    e.target.value = '';
    setIsUploadingCustom(true);
    setError(null);
    try {
      const dataUrl = await compressImageForUpload(file);
      setGeneratedImages([dataUrl]);
    } catch (err: any) {
      setError(err.message || 'Błąd przetwarzania zdjęcia.');
    } finally {
      setIsUploadingCustom(false);
    }
  };

  const handleHybridPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    e.target.value = '';
    setIsUploadingDishRef(true);
    setError(null);
    try {
      const dataUrl = await compressImageForUpload(file);
      setDishReferenceImage(dataUrl);
    } catch (err: any) {
      setError(err.message || 'Błąd przetwarzania zdjęcia.');
    } finally {
      setIsUploadingDishRef(false);
    }
  };

  const handleGenerate = async () => {
    const effectiveParams = getEffectiveParams();
    if (!effectiveParams.dishName) {
      setError("Podaj nazwę dania.");
      return;
    }
    if (hasNoCredits) {
      setError("Brak kredytów. Przejdź na plan Premium, aby dalej generować wizualizacje.");
      return;
    }
    setError(null);
    setIsGenerating(true);
    try {
      const aiSettings = buildAiSettings(effectiveParams);
      const result: GenerationResult = await generateDishImageWithAI(effectiveParams, aiSettings, {
        backdropImage: customBaseImage || undefined,
        tablewareImage: customTablewareImage || undefined,
        dishReferenceImage: dishReferenceImage || undefined,
        ingredientsHint: ingredientsText.trim() || undefined,
      });
      let img = result.image;
      if (isFreeTrialOver) img = await addWatermark(img);
      setGeneratedImages([img]);
      // Credits are decremented server-side – update UI with authoritative value from server
      if (result.creditsRemaining !== undefined) {
        onCreditsUpdated?.(result.creditsRemaining);
      }
    } catch (err: any) {
      setError(err.message || "Błąd wizualizacji.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-24">
      <div className="bg-white p-10 rounded-[40px] shadow-xl border border-slate-100 space-y-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-indigo-50 text-indigo-600 rounded-3xl"><Palette size={32} /></div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight italic">Chef’s Studio</h2>
          </div>
          {!isSubscribed && (
            <div className="text-[10px] font-black uppercase tracking-widest">
              <span className={hasNoCredits ? 'text-red-500' : 'text-slate-400'}>Kredyty: {credits}/5</span>
            </div>
          )}
        </div>

        {hasNoCredits && (
          <div className="bg-slate-900 border border-amber-500/30 p-6 rounded-[30px] flex items-center justify-between text-white">
            <div className="flex items-center gap-4">
              <Crown className="text-amber-500" />
              <div>
                <p className="font-black">Brak kredytów</p>
                <p className="text-xs opacity-60">Aby dalej generować wizualizacje, przejdź na plan Premium.</p>
              </div>
            </div>
            <button onClick={onBuyPremium} className="bg-amber-500 text-slate-900 px-6 py-3 rounded-2xl font-black text-sm hover:bg-amber-400 transition-colors">
              Plan Premium
            </button>
          </div>
        )}
        {isFreeTrialOver && !hasNoCredits && (
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-[30px] flex items-center justify-between text-white">
            <div className="flex items-center gap-4">
              <Crown className="text-amber-500" />
              <div>
                <p className="font-black">Tryb Free - Znak Wodny</p>
                <p className="text-xs opacity-60">Wykorzystałeś limit. Zdjęcia będą miały logo Chefvision.</p>
              </div>
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

        <div className="space-y-8">
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 block mb-2">Nazwa dania</label>
            <div className="relative">
              <input
                type="text"
                className="w-full px-8 py-5 border-2 border-slate-50 focus:ring-4 focus:ring-chef-beige/40 rounded-3xl outline-none transition-all placeholder-slate-300 text-2xl font-serif italic bg-slate-50/50"
                placeholder="np. Polędwica Wellington..."
                value={params.dishName}
                onChange={(e) => setParams((prev) => ({ ...prev, dishName: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 block mb-2">Składniki (opcjonalnie)</label>
            <textarea
              className="w-full px-6 py-4 border-2 border-slate-50 focus:ring-4 focus:ring-chef-beige/40 rounded-2xl outline-none transition-all placeholder-slate-300 text-slate-700 bg-slate-50/50 resize-none"
              placeholder="np. wołowina, grzyby, ciasto francuskie..."
              value={ingredientsText}
              onChange={(e) => setIngredientsText(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-4 sm:items-start">
            <div className="flex-1 flex flex-col gap-1.5 min-w-0">
              <button onClick={handleGenerate} disabled={isGenerating || hasNoCredits} className="w-full py-6 bg-chef-dark text-white rounded-[30px] font-black text-2xl flex items-center justify-center gap-3 shadow-xl hover:scale-[0.99] transition-transform disabled:opacity-50 disabled:cursor-not-allowed min-w-0">
                {isGenerating ? <Loader2 className="animate-spin" /> : <Wand2 />} {isGenerating ? 'MIKSUJĘ...' : hasNoCredits ? 'BRAK KREDYTÓW' : dishReferenceImage ? 'ULEPSZ ZDJĘCIE' : 'STWÓRZ NOWE DANIE OD ZERA'}
              </button>
              {!dishReferenceImage && (
                <p className="text-[10px] sm:text-[11px] text-center text-slate-400 font-medium leading-snug px-1">
                  Brak zdjęcia? Wygeneruj koncept z opisu
                </p>
              )}
            </div>
            <div className="flex-1 flex flex-col gap-1.5 min-w-0">
              <input
                ref={dishRefInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={handleHybridPhotoUpload}
              />
              <button
                type="button"
                onClick={() => dishRefInputRef.current?.click()}
                disabled={isUploadingDishRef}
                className="w-full py-6 bg-white text-slate-900 rounded-[30px] font-black text-xl flex items-center justify-center gap-3 border-2 border-slate-200 hover:border-chef-teal hover:bg-chef-cream/50 transition-all disabled:opacity-50 min-w-0"
              >
                {isUploadingDishRef ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <Camera />
                    <Wand2 />
                  </span>
                )}{' '}
                Ulepsz istniejące danie
              </button>
              <p className="text-[10px] sm:text-[11px] text-center text-slate-400 font-medium leading-snug px-1">
                Masz zdjęcie? Zamień je w sztukę, która sprzedaje
              </p>
            </div>
            {/* label + input zamiast programatycznego .click() — przeglądarki blokują otwarcie okna dla inputów z display:none */}
            <label
              className={`flex-1 py-6 bg-white text-slate-700 rounded-[30px] font-bold text-sm sm:text-base flex items-center justify-center gap-2 border-2 border-slate-200 hover:bg-slate-50 transition-all min-w-0 px-2 text-center leading-tight ${isUploadingCustom ? 'opacity-50 pointer-events-none cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                tabIndex={-1}
                disabled={isUploadingCustom}
                onChange={handleCustomPhotoUpload}
              />
              {isUploadingCustom ? <Loader2 className="animate-spin shrink-0" /> : <Camera className="shrink-0" />} Wgraj własne zdjęcie (bez AI)
            </label>
          </div>

          {dishReferenceImage && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-chef-cream border border-chef-beige/40">
              <img src={dishReferenceImage} alt="Zdjęcie dania" className="w-20 h-20 object-cover rounded-xl" />
              <span className="text-sm font-medium text-chef-dark flex-1">Zdjęcie dania do ulepszenia (tryb Hybrid)</span>
              <button type="button" onClick={() => setDishReferenceImage(null)} className="p-2 rounded-xl text-chef-teal hover:bg-chef-cream">
                <X size={18} />
              </button>
            </div>
          )}

          <div className="border-t border-slate-100 pt-6">
            <button
              type="button"
              onClick={() => setAdvancedSettingsOpen(!advancedSettingsOpen)}
              disabled={hybridModeActive}
              title={hybridModeActive ? 'Niedostępne w trybie Hybrid Photo Mode' : undefined}
              className="w-full flex items-center justify-between py-3 px-4 rounded-2xl border-2 border-slate-100 hover:bg-slate-50 text-slate-700 font-bold disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <span>Dopasuj detale do charakteru Twojej kuchni</span>
              <span className="text-slate-400">{advancedSettingsOpen ? '▼' : '▶'}</span>
            </button>

            {advancedSettingsOpen && (
              <div className="mt-6 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase text-slate-400">Stylistyka</label>
                    <div className="grid grid-cols-2 gap-2">
                      {STYLE_OPTIONS.map(opt => (
                        <button key={opt.value} onClick={() => setParams({ ...params, style: opt.value })} className={`p-4 rounded-2xl text-xs font-black border-2 transition-all ${params.style === opt.value ? 'bg-chef-teal text-white border-chef-teal' : 'bg-white text-slate-500 border-slate-50'}`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase text-slate-400">Oświetlenie</label>
                    <div className="grid grid-cols-2 gap-2">
                      {LIGHTING_OPTIONS.map(opt => {
                        const isLockedByBistro = isBistroLifestyle && opt.label !== 'Naturalne';
                        return (
                          <button
                            key={opt.value}
                            onClick={() => setParams({ ...params, lighting: opt.value })}
                            disabled={isLockedByBistro}
                            title={isLockedByBistro ? 'Styl Bistro Lifestyle wymaga naturalnego oświetlenia.' : undefined}
                            className={`p-4 rounded-2xl text-xs font-black border-2 transition-all ${params.lighting === opt.value ? 'bg-chef-gold text-white border-chef-gold' : 'bg-white text-slate-500 border-slate-50'} disabled:opacity-30 disabled:cursor-not-allowed`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase text-slate-400">Tło i zastawa</label>
                    <div className="grid grid-cols-2 gap-2">
                      {PLATE_OPTIONS.map(opt => {
                        const value = String(opt.value).toLowerCase();
                        const label = opt.label.toLowerCase();
                        const isKamienLupOption = value.includes('stone') || label.includes('kamień') || label.includes('łupek') || value.includes('dark');
                        const isBialaPorcelanaOption = label.includes('biała porcelana') || value.includes('porcelain');

                        const isStyleLockedBistro = isBistroLifestyle && isKamienLupOption;
                        const isStyleLockedStreetFood = isStreetFood && (isKamienLupOption || isBialaPorcelanaOption);

                        const isDisabled = !!customBaseImage || !!customTablewareImage || isStyleLockedBistro || isStyleLockedStreetFood;

                        return (
                          <button
                            key={opt.value}
                            onClick={() => setParams({ ...params, plateType: opt.value })}
                            disabled={isDisabled}
                            title={isStyleLockedBistro ? bistroLifestyleTooltipText : undefined}
                            className={`p-4 rounded-2xl text-xs font-black border-2 transition-all ${
                              params.plateType === opt.value ? 'bg-chef-dark text-white border-chef-dark' : 'bg-white text-slate-500 border-slate-50'
                            } disabled:opacity-30 disabled:cursor-not-allowed`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                      {isBistroLifestyle && (
                        <div className="col-span-2 text-[10px] text-amber-800 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-xl font-medium">
                          {bistroLifestyleTooltipText}
                        </div>
                      )}
                      <div className="col-span-2 flex gap-2">
                        <button onClick={() => setIsBackdropSelectorOpen(true)} disabled={isFreeTrialOver} className="flex-1 p-3 rounded-2xl border-2 border-dashed border-slate-200 text-[10px] font-black flex items-center justify-center gap-2 hover:bg-slate-50">
                          {isFreeTrialOver ? <Lock size={12}/> : <Layers size={14}/>} TŁO ZE STUDIA
                        </button>
                        <input ref={tablewareInputRef} type="file" accept="image/*" className="hidden" onChange={handleTablewareFile} />
                        <button type="button" onClick={() => tablewareInputRef.current?.click()} disabled={isFreeTrialOver} className="flex-1 p-3 rounded-2xl border-2 border-dashed border-slate-200 text-[10px] font-black flex items-center justify-center gap-2 hover:bg-slate-50">
                          {isFreeTrialOver ? <Lock size={12}/> : <UtensilsCrossed size={14}/>} WŁASNA ZASTAWA
                        </button>
                      </div>
                      {customTablewareImage && (
                        <div className="col-span-2 flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                          <img src={customTablewareImage} alt="Zastawa" className="w-14 h-14 object-cover rounded-xl" />
                          <span className="text-xs font-medium text-slate-600 flex-1">Wybrana zastawa</span>
                          <button type="button" onClick={() => setCustomTablewareImage(null)} className="p-2 rounded-xl text-slate-400 hover:bg-slate-200 hover:text-slate-700">
                            <X size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase text-slate-400">Perspektywa</label>
                    <div className="grid grid-cols-2 gap-2">
                      {ANGLE_OPTIONS.map(opt => (
                        <button key={opt.value} onClick={() => setParams({ ...params, cameraAngle: opt.value })} className={`p-4 rounded-2xl text-xs font-black border-2 transition-all ${params.cameraAngle === opt.value ? 'bg-chef-dark text-white border-chef-dark' : 'bg-white text-slate-500 border-slate-50'}`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {generatedImages.length > 0 && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8">
          <WatermarkWrapper
            show={!isSubscribed}
            className="rounded-[60px] overflow-hidden border-8 border-white shadow-2xl"
          >
            <>
              <img src={generatedImages[0]} className="w-full h-auto" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent p-12 flex flex-col justify-end">
                <h4 className="text-4xl font-serif italic text-white mb-2">{params.dishName}</h4>
              </div>
            </>
          </WatermarkWrapper>
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleGenerate}
              disabled={isGenerating || hasNoCredits}
              className="flex-1 py-6 bg-chef-dark text-white rounded-full font-black text-xl flex items-center justify-center gap-3 shadow-xl hover:bg-chef-dark2 transition-all disabled:opacity-50 disabled:cursor-not-allowed border-2 border-chef-dark"
            >
              {isGenerating ? <Loader2 className="animate-spin" size={28} /> : <RefreshCw size={28} />}
              {isGenerating ? 'REGENERUJĘ...' : 'REGENERUJ'}
            </button>
            <button
              onClick={() => onSaveStandard(generatedImages[0], params)}
              className="flex-1 py-6 bg-chef-gold text-white rounded-full font-black text-2xl flex items-center justify-center gap-3 shadow-2xl hover:bg-chef-gold2 transition-all"
            >
              <CheckCircle size={32} /> ZAPISZ JAKO STANDARD
            </button>
          </div>
        </div>
      )}

      {isBackdropSelectorOpen && (
        <div className="fixed inset-0 z-[400] bg-black/80 backdrop-blur flex items-center justify-center p-8">
          <div className="bg-white rounded-[40px] w-full max-w-4xl p-8 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black">Twoje Studio Tła</h3>
              <button onClick={() => setIsBackdropSelectorOpen(false)}><X/></button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {savedBackdrops.map(b => (
                <img key={b.id} src={b.imageUrl} onClick={() => { setCustomBaseImage(b.imageUrl); setIsBackdropSelectorOpen(false); }} className="rounded-2xl cursor-pointer hover:ring-4 ring-indigo-500 transition-all" />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
