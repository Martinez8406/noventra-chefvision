
import React, { useState, useRef, useEffect } from 'react';
import { Dish, Allergen } from '../types';
import { ALLERGENS_LIST } from '../constants';
import { compressImageForUpload } from '../services/imageService';
import { uploadDishImage } from '../services/supabaseService';
import {
  X,
  Save,
  Plus,
  Info,
  Utensils,
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  Camera,
  Loader2
} from 'lucide-react';

interface Props {
  dish: Dish;
  onClose: () => void;
  onSave: (updatedDish: Dish) => void;
  userId?: string;
}

const LEGACY_TECHNIQUE_DEFAULTS = [
  'Dodaj notatki dotyczące dania...',
  'Wpisz technologię przygotowania dania...',
];

const normalizeTechnique = (technique?: string) => {
  const value = (technique ?? '').trim();
  if (!value) return '';
  return LEGACY_TECHNIQUE_DEFAULTS.includes(value) ? '' : technique ?? '';
};

export const DishDetailPanel: React.FC<Props> = ({ dish, onClose, onSave, userId }) => {
  const [editedDish, setEditedDish] = useState<Dish>({
    ...dish,
    technique: normalizeTechnique(dish.technique),
  });
  const [newIngredient, setNewIngredient] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const customImageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditedDish({
      ...dish,
      technique: normalizeTechnique(dish.technique),
    });
  }, [dish]);

  const handleCustomImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    e.target.value = '';
    if (!userId) return;
    setIsUploadingImage(true);
    try {
      const dataUrl = await compressImageForUpload(file);
      const imageUrl = await uploadDishImage(dataUrl, userId);
      setEditedDish((prev) => ({ ...prev, imageUrl }));
    } catch (err) {
      console.error('Błąd wgrywania zdjęcia:', err);
      alert(err instanceof Error ? err.message : 'Nie udało się wgrać zdjęcia.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const toggleAllergen = (allergen: Allergen) => {
    const next = editedDish.allergens.includes(allergen)
      ? editedDish.allergens.filter(a => a !== allergen)
      : [...editedDish.allergens, allergen];
    setEditedDish({ ...editedDish, allergens: next as Allergen[] });
  };

  const addIngredient = () => {
    if (!newIngredient.trim()) return;
    setEditedDish({
      ...editedDish,
      ingredients: [...editedDish.ingredients, newIngredient.trim()]
    });
    setNewIngredient('');
  };

  const removeIngredient = (index: number) => {
    setEditedDish({
      ...editedDish,
      ingredients: editedDish.ingredients.filter((_, i) => i !== index)
    });
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-[500px] bg-white shadow-2xl z-[200] flex flex-col animate-in slide-in-from-right duration-300">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center">
            <Utensils size={20} className="text-amber-500" />
          </div>
          <div>
            <h3 className="font-black text-slate-900 tracking-tight italic">Edycja Standardu</h3>
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">ID: {dish.id}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <X size={24} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-8">
        {/* Header Preview + Wgraj własne zdjęcie */}
        <div className="space-y-4">
          <div className="relative h-48 rounded-[30px] overflow-hidden border-4 border-slate-50 shadow-inner group">
            <img src={editedDish.imageUrl} alt={editedDish.name} className="w-full h-full object-cover" />
          </div>
          <input
            ref={customImageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleCustomImageUpload}
          />
          <button
            type="button"
            onClick={() => customImageInputRef.current?.click()}
            disabled={isUploadingImage}
            className="w-full py-3 rounded-2xl border-2 border-dashed border-slate-200 text-slate-600 font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-50 hover:border-indigo-300 transition-colors disabled:opacity-50"
          >
            {isUploadingImage ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
            Wgraj własne zdjęcie {isUploadingImage ? '(kompresuję...)' : ''}
          </button>
        </div>

        {/* Basic Info */}
        <div className="space-y-4">
          <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest ml-2">Nazwa i Opis Marketingowy</label>
          <input 
            type="text" 
            value={editedDish.name}
            onChange={(e) => setEditedDish({ ...editedDish, name: e.target.value })}
            className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-amber-500/10 font-black text-lg"
          />
          <textarea 
            value={editedDish.description}
            onChange={(e) => setEditedDish({ ...editedDish, description: e.target.value })}
            placeholder="Krótki opis, który zobaczy gość..."
            className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-amber-500/10 text-sm font-medium h-24 resize-none"
          />
        </div>

        {/* Ingredients */}
        <div className="space-y-4">
          <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest ml-2 flex items-center gap-2">
            <Info size={12}/> Składniki receptury
          </label>
          <div className="flex gap-2">
            <input 
              type="text"
              placeholder="Dodaj składnik..."
              value={newIngredient}
              onChange={(e) => setNewIngredient(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addIngredient()}
              className="flex-1 px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none text-xs font-bold"
            />
            <button onClick={addIngredient} className="bg-slate-900 text-white p-3 rounded-xl hover:bg-slate-800"><Plus size={20}/></button>
          </div>
          <div className="flex flex-wrap gap-2">
            {editedDish.ingredients.map((ing, i) => (
              <div key={i} className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                <span className="text-[11px] font-black text-slate-600">{ing}</span>
                <button onClick={() => removeIngredient(i)} className="text-slate-400 hover:text-red-500"><X size={12}/></button>
              </div>
            ))}
          </div>
        </div>

        {/* Technique */}
        <div className="space-y-4">
          <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest ml-2 flex items-center gap-2">
            <BookOpen size={12}/> Technika wykonania (to pole jest niewidoczne w menu online dla gości. Dodaj tu notatki dla pracowników)
          </label>
          <textarea 
            value={editedDish.technique}
            onChange={(e) => setEditedDish({ ...editedDish, technique: e.target.value })}
            placeholder="Dodaj notatki dotyczące dania..."
            className="w-full px-6 py-4 bg-slate-900 text-amber-50 rounded-2xl outline-none focus:ring-4 focus:ring-amber-500/20 text-xs font-medium h-40 font-mono leading-relaxed"
          />
        </div>

        {/* Allergens */}
        <div className="space-y-4 pb-10">
          <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest ml-2 flex items-center gap-2 text-red-500">
            <AlertTriangle size={12}/> Alergeny
          </label>
          <div className="grid grid-cols-2 gap-2">
            {ALLERGENS_LIST.map((allergen) => (
              <button
                key={allergen}
                onClick={() => toggleAllergen(allergen as Allergen)}
                className={`flex items-center justify-between px-4 py-3 rounded-xl text-[10px] font-black uppercase border-2 transition-all ${editedDish.allergens.includes(allergen as Allergen) ? 'bg-red-50 border-red-500 text-red-600 shadow-sm' : 'bg-white border-slate-50 text-slate-400 hover:border-slate-200'}`}
              >
                {allergen}
                {editedDish.allergens.includes(allergen as Allergen) && <CheckCircle2 size={12}/>}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6 border-t border-slate-100 bg-slate-50/80 backdrop-blur">
        <button 
          onClick={() => onSave(editedDish)}
          className="w-full bg-amber-500 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-amber-500/20 hover:bg-amber-600 transition-all flex items-center justify-center gap-3 active:scale-95"
        >
          <Save size={24} /> ZAPISZ ZMIANY W STANDARDZIE
        </button>
      </div>
    </div>
  );
};
