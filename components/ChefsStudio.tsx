
import React, { useState, useRef } from 'react';
import { LIGHTING_OPTIONS, PLATE_OPTIONS, ANGLE_OPTIONS, STYLE_OPTIONS } from '../constants';
import { generateDishImageWithAI, AiDishSettings } from '../services/aiService';
import { GeneratorParams, Backdrop } from '../types';
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
  Zap,
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
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [customBaseImage, setCustomBaseImage] = useState<string | null>(null);
  const [customTablewareImage, setCustomTablewareImage] = useState<string | null>(null);
  const [isBackdropSelectorOpen, setIsBackdropSelectorOpen] = useState(false);
  const tablewareInputRef = useRef<HTMLInputElement>(null);

  const isFreeTrialOver = !isSubscribed && generationsUsed >= 5;
  const hasNoCredits = !isSubscribed && credits <= 0;

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

  const buildAiSettings = (): AiDishSettings => {
    const styleLabel = STYLE_OPTIONS.find(o => o.value === params.style)?.label || params.style;
    const lightingLabel = LIGHTING_OPTIONS.find(o => o.value === params.lighting)?.label || params.lighting;
    const plateLabel = PLATE_OPTIONS.find(o => o.value === params.plateType)?.label || params.plateType;
    const angleLabel = ANGLE_OPTIONS.find(o => o.value === params.cameraAngle)?.label || params.cameraAngle;

    return {
      dishName: params.dishName,
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

  const handleGenerate = async () => {
    if (!params.dishName) {
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
      const aiSettings = buildAiSettings();
      let img = await generateDishImageWithAI(params, aiSettings, {
        backdropImage: customBaseImage || undefined,
        tablewareImage: customTablewareImage || undefined,
      });
      if (isFreeTrialOver) img = await addWatermark(img);
      setGeneratedImages([img]);
      if (!isSubscribed && credits > 0) {
        onGenerationSuccess?.();
        onCreditsUpdated?.(credits - 1);
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
          <div className="flex flex-col items-end gap-2 text-[10px] font-black uppercase tracking-widest">
            {!isSubscribed && <span className={hasNoCredits ? 'text-red-500' : 'text-slate-400'}>Kredyty: {credits}/5</span>}
            <div className="bg-amber-500/10 text-amber-600 px-3 py-1 rounded-full flex items-center gap-1">
              <Zap size={10}/> Wizja 2.5 Flash
            </div>
          </div>
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

        <div className="space-y-8">
          <div className="relative">
            <input
              type="text"
              className="w-full px-8 py-5 border-2 border-slate-50 focus:ring-4 focus:ring-indigo-50 rounded-3xl outline-none transition-all placeholder-slate-300 text-2xl font-serif italic bg-slate-50/50"
              placeholder="np. Polędwica Wellington..."
              value={params.dishName}
              onChange={(e) => setParams({ ...params, dishName: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase text-slate-400">Stylistyka</label>
              <div className="grid grid-cols-2 gap-2">
                {STYLE_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => setParams({ ...params, style: opt.value })} className={`p-4 rounded-2xl text-xs font-black border-2 transition-all ${params.style === opt.value ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-50'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase text-slate-400">Oświetlenie</label>
              <div className="grid grid-cols-2 gap-2">
                {LIGHTING_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => setParams({ ...params, lighting: opt.value })} className={`p-4 rounded-2xl text-xs font-black border-2 transition-all ${params.lighting === opt.value ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-500 border-slate-50'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase text-slate-400">Tło i zastawa</label>
              <div className="grid grid-cols-2 gap-2">
                {PLATE_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => setParams({ ...params, plateType: opt.value })} disabled={!!customBaseImage || !!customTablewareImage} className={`p-4 rounded-2xl text-xs font-black border-2 transition-all ${params.plateType === opt.value ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-50'} disabled:opacity-30`}>
                    {opt.label}
                  </button>
                ))}
                <div className="col-span-2 flex gap-2">
                  <button onClick={() => setIsBackdropSelectorOpen(true)} disabled={isFreeTrialOver} className="flex-1 p-3 rounded-2xl border-2 border-dashed border-slate-200 text-[10px] font-black flex items-center justify-center gap-2 hover:bg-slate-50">
                    {isFreeTrialOver ? <Lock size={12}/> : <Layers size={14}/>} TŁO ZE STUDIA
                  </button>
                  <input
                    ref={tablewareInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleTablewareFile}
                  />
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
                  <button key={opt.value} onClick={() => setParams({ ...params, cameraAngle: opt.value })} className={`p-4 rounded-2xl text-xs font-black border-2 transition-all ${params.cameraAngle === opt.value ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-50'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button onClick={handleGenerate} disabled={isGenerating || hasNoCredits} className="w-full py-6 bg-slate-900 text-white rounded-[30px] font-black text-2xl flex items-center justify-center gap-3 shadow-xl hover:scale-[0.99] transition-transform disabled:opacity-50 disabled:cursor-not-allowed">
            {isGenerating ? <Loader2 className="animate-spin" /> : <Wand2 />} {isGenerating ? 'MIKSUJĘ...' : hasNoCredits ? 'BRAK KREDYTÓW – PLAN PREMIUM' : 'STWÓRZ WIZUALIZACJĘ'}
          </button>
        </div>
      </div>

      {generatedImages.length > 0 && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8">
          <div className="relative rounded-[60px] overflow-hidden border-8 border-white shadow-2xl">
            <img src={generatedImages[0]} className="w-full h-auto" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent p-12 flex flex-col justify-end">
              <h4 className="text-4xl font-serif italic text-white mb-2">{params.dishName}</h4>
            </div>
          </div>
          <button onClick={() => onSaveStandard(generatedImages[0], params)} className="w-full py-6 bg-amber-500 text-white rounded-full font-black text-2xl flex items-center justify-center gap-3 shadow-2xl hover:bg-amber-600 transition-all">
            <CheckCircle size={32} /> ZAPISZ JAKO STANDARD
          </button>
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
