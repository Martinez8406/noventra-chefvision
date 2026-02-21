
import React, { useState } from 'react';
import { LIGHTING_OPTIONS, PLATE_OPTIONS, ANGLE_OPTIONS, STYLE_OPTIONS } from '../constants';
import { generateDishImage } from '../services/geminiService';
import { GeneratorParams, UserRole } from '../types';
import { Loader2, Wand2, CheckCircle, Save } from 'lucide-react';

interface Props {
  userRole: UserRole;
  onSaveStandard: (imageUrl: string, params: GeneratorParams) => void;
}

export const DishGenerator: React.FC<Props> = ({ userRole, onSaveStandard }) => {
  // Fix: Added missing 'style' property to satisfy GeneratorParams interface requirement
  const [params, setParams] = useState<GeneratorParams>({
    dishName: '',
    lighting: LIGHTING_OPTIONS[0].value,
    plateType: PLATE_OPTIONS[0].value,
    cameraAngle: ANGLE_OPTIONS[0].value,
    style: STYLE_OPTIONS[0].value,
  });
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!params.dishName) {
      setError("Wpisz nazwę dania!");
      return;
    }
    setError(null);
    setIsGenerating(true);
    try {
      const img = await generateDishImage(params);
      setGeneratedImage(img);
    } catch (err) {
      setError("Wystąpił błąd podczas generowania obrazu.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-2xl shadow-xl border border-slate-100">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-amber-100 text-amber-600 rounded-lg">
          <Wand2 size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Generator Wizualizacji Chefvision</h2>
          <p className="text-slate-500 text-sm">Zaprojektuj idealne danie za pomocą AI</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Form Column */}
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Nazwa Dania</label>
            <input
              type="text"
              className="w-full px-4 py-2 bg-white text-slate-900 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition-all placeholder-slate-400"
              placeholder="np. Polędwica Wellington z truflowym puree"
              value={params.dishName}
              onChange={(e) => setParams({ ...params, dishName: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Oświetlenie</label>
            <select
              className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none bg-white"
              value={params.lighting}
              onChange={(e) => setParams({ ...params, lighting: e.target.value })}
            >
              {LIGHTING_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Rodzaj Talerza</label>
            <select
              className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none bg-white"
              value={params.plateType}
              onChange={(e) => setParams({ ...params, plateType: e.target.value })}
            >
              {PLATE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Kąt Kamery</label>
            <select
              className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none bg-white"
              value={params.cameraAngle}
              onChange={(e) => setParams({ ...params, cameraAngle: e.target.value })}
            >
              {ANGLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>

          {/* Added missing style selector to allow user to customize the mandatory style parameter */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Styl</label>
            <select
              className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none bg-white"
              value={params.style}
              onChange={(e) => setParams({ ...params, style: e.target.value })}
            >
              {STYLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 disabled:bg-slate-300 transition-colors"
          >
            {isGenerating ? <Loader2 className="animate-spin" /> : <Wand2 size={20} />}
            {isGenerating ? 'Generowanie...' : 'Wygeneruj Podgląd'}
          </button>
          
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </div>

        {/* Result Column */}
        <div className="bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center min-h-[400px] overflow-hidden relative group">
          {generatedImage ? (
            <>
              <img src={generatedImage} alt="Preview" className="w-full h-full object-cover" />
              {userRole === UserRole.CHEF && (
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <button
                    onClick={() => onSaveStandard(generatedImage, params)}
                    className="bg-amber-500 text-white px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-amber-600 shadow-lg"
                  >
                    <CheckCircle size={20} />
                    Ustaw jako standard wydawki
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center p-8">
              <div className="w-20 h-20 bg-slate-200 rounded-full mx-auto mb-4 flex items-center justify-center text-slate-400">
                <Wand2 size={32} />
              </div>
              <p className="text-slate-400 font-medium">Uzupełnij parametry i kliknij przycisk, aby zobaczyć magię</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
