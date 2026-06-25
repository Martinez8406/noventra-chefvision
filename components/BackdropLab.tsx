
import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MAX_USER_BACKDROPS } from '../constants';
import { BlurLevel } from '../types';
import { processBackdropImage } from '../services/geminiService';
import {
  Upload,
  X,
  Loader2,
  Check,
  Image as ImageIcon,
  Sparkles,
  Layers,
  Download,
  RotateCcw,
  Save,
  CheckCircle2,
} from 'lucide-react';

interface Props {
  onSaveBackdrop: (imageUrl: string) => void | Promise<void>;
  showFreeWatermark?: boolean;
  canUseAi?: boolean;
  onRequestPremium?: () => void;
}

const BLUR_OPTION_KEYS: Record<BlurLevel, 'natural' | 'instagram' | 'fineDining'> = {
  [BlurLevel.NATURAL]: 'natural',
  [BlurLevel.INSTAGRAM]: 'instagram',
  [BlurLevel.FINE_DINING]: 'fineDining',
};

export const BackdropLab: React.FC<Props> = ({
  onSaveBackdrop,
  showFreeWatermark = false,
  canUseAi = false,
  onRequestPremium,
}) => {
  const { t } = useTranslation('backdrops');
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [blurLevel, setBlurLevel] = useState<BlurLevel>(BlurLevel.NATURAL);
  const [isSaved, setIsSaved] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const blurOptions = [BlurLevel.NATURAL, BlurLevel.INSTAGRAM, BlurLevel.FINE_DINING];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setSourceImage(event.target?.result as string);
      reader.readAsDataURL(file);
      setBlurLevel(BlurLevel.NATURAL);
    }
  };

  const handleProcess = async () => {
    if (!sourceImage) return;
    if (!canUseAi) {
      if (showFreeWatermark) {
        onRequestPremium?.();
      } else {
        alert(t('errors.noTokens'));
      }
      return;
    }
    setIsProcessing(true);
    setProcessedImage(null);
    setIsSaved(false);
    try {
      const result = await processBackdropImage(sourceImage, blurLevel);
      setProcessedImage(result);
    } catch {
      alert(t('errors.processing'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = async () => {
    if (!processedImage || isSaving) return;
    setIsSaving(true);
    try {
      await onSaveBackdrop(processedImage);
      setIsSaved(true);
    } catch {
      alert(t('errors.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10">
      <div className="bg-slate-900 text-white p-12 rounded-[50px] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-10 rotate-12"><Layers size={200} /></div>
        <div className="relative z-10 space-y-4">
          <h2 className="text-4xl font-black italic tracking-tighter">{t('title')}</h2>
          <p className="text-slate-400 max-w-2xl text-lg">{t('subtitle')}</p>
        </div>
        {showFreeWatermark && (
          <div className="relative z-10 mt-6 max-w-xl text-xs text-slate-300 font-medium">
            {t('freePlanHint')}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-1 space-y-8">
          <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-xl space-y-6">
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
              <ImageIcon size={24} className="text-indigo-500" /> {t('sourceTitle')}
            </h3>

            {!sourceImage ? (
              <div className="space-y-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-3 p-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl text-slate-500 font-bold hover:bg-indigo-50 hover:border-indigo-200 transition-all"
                >
                  <Upload size={24} /> {t('uploadFromDisk')}
                </button>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />
              </div>
            ) : (
              <div className="relative group rounded-3xl overflow-hidden border-4 border-slate-50">
                <img src={sourceImage} className="w-full aspect-square object-cover" alt="" />
                <button
                  onClick={() => { setSourceImage(null); setProcessedImage(null); }}
                  className="absolute top-4 right-4 bg-red-500 text-white p-2 rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={20} />
                </button>
              </div>
            )}
          </div>

          {sourceImage && (
            <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-xl space-y-6">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                <Sparkles size={24} className="text-amber-500" /> {t('blurTitle')}
              </h3>
              <div className="space-y-3">
                {blurOptions.map((level) => {
                  const key = BLUR_OPTION_KEYS[level];
                  return (
                    <button
                      key={level}
                      onClick={() => setBlurLevel(level)}
                      className={`w-full text-left p-5 rounded-3xl border-2 transition-all flex items-center justify-between ${blurLevel === level ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-600 hover:border-indigo-200'}`}
                    >
                      <div>
                        <p className="font-black uppercase text-[10px] tracking-widest opacity-80 mb-1">{t(`blur.${key}.title`)}</p>
                        <p className="text-xs font-bold">{t(`blur.${key}.desc`)}</p>
                      </div>
                      {blurLevel === level && <Check size={20} />}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={handleProcess}
                disabled={isProcessing || !canUseAi}
                className="w-full bg-slate-900 text-white py-5 rounded-[25px] font-black text-lg flex items-center justify-center gap-3 hover:bg-slate-800 transition-all shadow-xl disabled:bg-slate-200 disabled:cursor-not-allowed"
              >
                {isProcessing ? <Loader2 className="animate-spin" /> : <Sparkles size={24} />}
                {isProcessing ? t('process.processing') : canUseAi ? t('process.prepare') : t('process.unavailable')}
              </button>
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white p-8 rounded-[50px] border border-slate-100 shadow-2xl h-full flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-black text-slate-800 tracking-tight italic">{t('previewTitle')}</h3>
              {processedImage && (
                <div className="flex gap-2">
                  <button onClick={() => window.open(processedImage)} className="bg-slate-100 p-3 rounded-2xl text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-all"><Download size={20}/></button>
                  <button onClick={() => { setProcessedImage(null); setIsSaved(false); }} className="bg-slate-100 p-3 rounded-2xl text-slate-600 hover:bg-red-50 hover:text-red-600 transition-all"><RotateCcw size={20}/></button>
                </div>
              )}
            </div>

            <div className="flex-1 bg-slate-50 rounded-[40px] overflow-hidden border-4 border-slate-100 flex items-center justify-center relative min-h-[500px]">
              {isProcessing ? (
                <div className="text-center space-y-4">
                  <Loader2 size={64} className="animate-spin text-indigo-500 mx-auto" />
                </div>
              ) : processedImage ? (
                <>
                  <img src={processedImage} className="w-full h-full object-cover" alt={t('preview.processedAlt')} />
                  {showFreeWatermark && (
                    <div className="absolute bottom-4 right-4 text-[10px] font-semibold text-white/60 drop-shadow-md">
                      Powered by <span className="font-bold">noventralabs.com</span>
                    </div>
                  )}
                </>
              ) : sourceImage ? (
                <div className="relative w-full h-full">
                  <img src={sourceImage} className="w-full h-full object-cover opacity-40 grayscale" alt={t('preview.sourceAlt')} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="bg-white/90 px-8 py-4 rounded-3xl font-black text-slate-400 text-sm shadow-xl">{t('preview.clickToStart')}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <div className="w-20 h-20 bg-white rounded-full mx-auto flex items-center justify-center shadow-sm text-slate-200"><ImageIcon size={40} /></div>
                  <p className="text-slate-300 font-bold uppercase tracking-widest text-sm">{t('preview.choosePhoto')}</p>
                </div>
              )}

              {processedImage && (
                <div className="absolute top-8 left-8 bg-green-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2">
                  <Check size={12} /> {t('preview.readyBadge')}
                </div>
              )}
            </div>

            {processedImage && !isProcessing ? (
              <div className="mt-8 bg-indigo-50 p-6 rounded-3xl border border-indigo-100 space-y-4">
                <p className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">{t('actions.title')}</p>
                <button
                  onClick={() => void handleSave()}
                  disabled={isSaved || isSaving}
                  className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all hover:bg-indigo-700 disabled:bg-green-600 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : isSaved ? (
                    <CheckCircle2 size={18} />
                  ) : (
                    <Save size={18} />
                  )}
                  {isSaving ? t('actions.saving') : isSaved ? t('actions.saved') : t('actions.save')}
                </button>
                <p className="text-xs text-indigo-500 text-center">
                  {t('actions.saveHint', { max: MAX_USER_BACKDROPS })}
                </p>
              </div>
            ) : (
              <div className="mt-8 grid grid-cols-2 gap-4">
                <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100">
                  <p className="text-[10px] font-black uppercase text-indigo-400 tracking-widest mb-1">{t('status.label')}</p>
                  <p className="text-sm font-bold text-indigo-900">{processedImage ? t('status.ready') : t('status.waiting')}</p>
                </div>
                <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100">
                  <p className="text-[10px] font-black uppercase text-amber-400 tracking-widest mb-1">{t('tip.label')}</p>
                  <p className="text-sm font-bold text-amber-900">{t('tip.text')}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
