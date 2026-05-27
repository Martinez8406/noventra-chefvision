import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseService';
import { Loader2, ImagePlus, CheckCircle, Save } from 'lucide-react';
import { MenuHeroIdentityPreview } from './MenuHeroIdentityPreview';
import {
  DEFAULT_LOGO_POSITION,
  DEFAULT_LOGO_SCALE,
  LOGO_POSITION_GRID,
  MAX_LOGO_SCALE,
  MIN_LOGO_SCALE,
  normalizeLogoPosition,
  normalizeLogoScale,
  isMissingLogoFrameColumns,
  type LogoObjectPosition,
} from '../utils/logoFrame';

interface Props {
  userId: string;
  restaurantName?: string;
}

export const UploadLogo: React.FC<Props> = ({ userId, restaurantName: restaurantNameProp }) => {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPosition, setLogoPosition] = useState<LogoObjectPosition>(DEFAULT_LOGO_POSITION);
  const [logoScale, setLogoScale] = useState(DEFAULT_LOGO_SCALE);
  const [savedPosition, setSavedPosition] = useState<LogoObjectPosition>(DEFAULT_LOGO_POSITION);
  const [savedScale, setSavedScale] = useState(DEFAULT_LOGO_SCALE);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState('#6366f1');
  const [restaurantName, setRestaurantName] = useState(restaurantNameProp?.trim() || 'Twoja Restauracja');

  const [uploading, setUploading] = useState(false);
  const [savingFrame, setSavingFrame] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [frameColumnsAvailable, setFrameColumnsAvailable] = useState(true);
  const [frameSaved, setFrameSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const frameDirty =
    logoPosition !== savedPosition || Math.abs(logoScale - savedScale) > 0.001;

  useEffect(() => {
    if (restaurantNameProp?.trim()) setRestaurantName(restaurantNameProp.trim());
  }, [restaurantNameProp]);

  useEffect(() => {
    if (!supabase || !userId) return;

    const loadProfile = async () => {
      const { error: schemaProbeError } = await supabase
        .from('profiles')
        .select('logo_object_position, logo_scale')
        .limit(0);

      const frameOk = !isMissingLogoFrameColumns(schemaProbeError);
      setFrameColumnsAvailable(frameOk);

      const selectFields = frameOk
        ? 'logo_url, logo_object_position, logo_scale, cover_url, primary_color, restaurant_name'
        : 'logo_url, cover_url, primary_color, restaurant_name';

      const { data, error: loadError } = await supabase
        .from('profiles')
        .select(selectFields)
        .eq('id', userId)
        .maybeSingle();

      if (loadError) {
        setError(loadError.message);
        return;
      }

      if (data?.logo_url) setLogoUrl(data.logo_url);
      if (data?.cover_url) setCoverUrl(data.cover_url);
      if (data?.primary_color) setPrimaryColor(data.primary_color);
      const title = data?.restaurant_name?.trim() || restaurantNameProp?.trim();
      if (title) setRestaurantName(title);

      if (frameOk && data) {
        const pos = normalizeLogoPosition((data as { logo_object_position?: string }).logo_object_position);
        const scale = normalizeLogoScale((data as { logo_scale?: number }).logo_scale);
        setLogoPosition(pos);
        setSavedPosition(pos);
        setLogoScale(scale);
        setSavedScale(scale);
      }
    };

    void loadProfile();
  }, [userId, restaurantNameProp]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !supabase) return;

    if (!file.type.startsWith('image/')) {
      setError('Wybierz plik graficzny (JPG, PNG, SVG…)');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Plik jest za duży (max 2 MB).');
      return;
    }

    setError(null);
    setSuccess(false);
    setUploading(true);

    try {
      const ext = file.name.split('.').pop() || 'png';
      const filePath = `logos/${userId}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('restaurant-logos')
        .upload(filePath, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('restaurant-logos').getPublicUrl(filePath);

      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: dbError } = await supabase
        .from('profiles')
        .update({
          logo_url: publicUrl,
          logo_object_position: DEFAULT_LOGO_POSITION,
          logo_scale: DEFAULT_LOGO_SCALE,
        })
        .eq('id', userId);

      if (dbError) {
        const { error: dbError2 } = await supabase
          .from('profiles')
          .update({ logo_url: publicUrl })
          .eq('id', userId);
        if (dbError2) throw dbError2;
      }

      setLogoUrl(publicUrl);
      setLogoPosition(DEFAULT_LOGO_POSITION);
      setSavedPosition(DEFAULT_LOGO_POSITION);
      setLogoScale(DEFAULT_LOGO_SCALE);
      setSavedScale(DEFAULT_LOGO_SCALE);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Błąd przesyłania logo.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!supabase) return;
    await supabase
      .from('profiles')
      .update({
        logo_url: null,
        logo_object_position: DEFAULT_LOGO_POSITION,
        logo_scale: DEFAULT_LOGO_SCALE,
      })
      .eq('id', userId);
    setLogoUrl(null);
    setLogoPosition(DEFAULT_LOGO_POSITION);
    setSavedPosition(DEFAULT_LOGO_POSITION);
    setLogoScale(DEFAULT_LOGO_SCALE);
    setSavedScale(DEFAULT_LOGO_SCALE);
  };

  const handleSaveFrame = async () => {
    if (!supabase || !logoUrl) return;
    setSavingFrame(true);
    setError(null);
    setFrameSaved(false);
    try {
      const { error: dbError } = await supabase
        .from('profiles')
        .update({
          logo_object_position: logoPosition,
          logo_scale: logoScale,
        })
        .eq('id', userId);

      if (dbError) {
        if (isMissingLogoFrameColumns(dbError)) {
          setFrameColumnsAvailable(false);
          throw new Error(
            'Kolumny kadrowania nie są widoczne w API. Uruchom migrację SQL (poniżej), potem w Supabase: Settings → API → Reload schema (lub odczekaj 1–2 min) i odśwież F5.'
          );
        }
        throw new Error(`Nie udało się zapisać kadrowania: ${dbError.message}`);
      }

      setFrameColumnsAvailable(true);
      setSavedPosition(logoPosition);
      setSavedScale(logoScale);
      setFrameSaved(true);
      setTimeout(() => setFrameSaved(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Błąd zapisu kadrowania.');
    } finally {
      setSavingFrame(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">
          Logo restauracji (widoczne w Live Menu)
        </label>
        <p className="text-xs text-slate-500 mt-1">
          Po wgraniu ustaw kadrowanie — podgląd poniżej wygląda tak samo jak w menu publicznym.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="px-5 py-2.5 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {uploading ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Przesyłanie…
            </>
          ) : (
            <>
              <ImagePlus size={14} /> {logoUrl ? 'Zmień logo' : 'Wgraj logo'}
            </>
          )}
        </button>
        {logoUrl && (
          <button
            type="button"
            onClick={() => void handleRemove()}
            className="px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
          >
            Usuń logo
          </button>
        )}
        {success && (
          <span className="flex items-center gap-1 text-xs text-green-600 font-semibold">
            <CheckCircle size={13} /> Logo wgrane!
          </span>
        )}
        <p className="text-[10px] text-slate-400 w-full sm:w-auto">PNG, JPG — max 2 MB</p>
      </div>

      {logoUrl && !frameColumnsAvailable && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 space-y-2">
          <p className="font-bold">Jednorazowa konfiguracja bazy (Supabase)</p>
          <p className="text-xs leading-relaxed">
            Aby zapisać kadrowanie logo, uruchom w <strong>Supabase → SQL Editor</strong> poniższy skrypt:
          </p>
          <pre className="text-[10px] bg-white border border-amber-100 rounded-xl p-3 overflow-x-auto whitespace-pre-wrap font-mono">
{`alter table public.profiles
  add column if not exists logo_object_position text not null default 'center',
  add column if not exists logo_scale numeric not null default 1;`}
          </pre>
          <p className="text-[10px] text-amber-800 leading-relaxed">
            Po uruchomieniu: Supabase → <strong>Settings → API → Reload schema</strong> (jeśli jest), potem{' '}
            <strong>F5</strong> w aplikacji. Upewnij się, że SQL uruchomiłeś w tym samym projekcie co w pliku .env.
          </p>
        </div>
      )}

      {logoUrl && (
        <div className="space-y-6 pt-2 border-t border-slate-100">
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">
              Podgląd — jak w menu publicznym
            </p>
            <div className="rounded-[28px] border border-slate-100 bg-chef-cream/50 p-4 sm:p-6 overflow-hidden">
              <MenuHeroIdentityPreview
                logoUrl={logoUrl}
                logoPosition={logoPosition}
                logoScale={logoScale}
                restaurantTitle={restaurantName}
                coverUrl={coverUrl}
                primaryColor={primaryColor}
                compactCover
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                Punkt kadrowania
              </p>
              <div className="grid grid-cols-3 gap-2 max-w-[220px]">
                {LOGO_POSITION_GRID.map((opt) => {
                  const active = logoPosition === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      title={opt.label}
                      onClick={() => setLogoPosition(opt.id)}
                      className={`aspect-square rounded-xl border-2 text-[9px] font-black uppercase tracking-wide transition-all ${
                        active
                          ? 'border-chef-gold bg-chef-gold/15 text-chef-dark shadow-sm'
                          : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      {opt.label.split(' ')[0]?.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">
                Rozmiar w ramce ({Math.round(logoScale * 100)}%)
              </label>
              <input
                type="range"
                min={MIN_LOGO_SCALE}
                max={MAX_LOGO_SCALE}
                step={0.05}
                value={logoScale}
                onChange={(e) => setLogoScale(Number(e.target.value))}
                className="w-full max-w-xs h-2 cursor-pointer appearance-none rounded-full bg-slate-200 accent-chef-gold"
              />
              <div className="flex justify-between max-w-xs text-[9px] text-slate-400 font-semibold uppercase tracking-wide">
                <span>Mniejsze</span>
                <span>100%</span>
                <span>Większe</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Przesuń w lewo, aby pomniejszyć logo. Punkt kadrowania ustawia, który fragment zostaje widoczny przy powiększeniu.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleSaveFrame()}
              disabled={savingFrame || !frameDirty}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-chef-dark text-white text-xs font-black uppercase tracking-widest hover:bg-chef-dark2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingFrame ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              Zapisz kadrowanie
            </button>
            {frameSaved && (
              <span className="flex items-center gap-1 text-xs text-green-600 font-semibold">
                <CheckCircle size={13} /> Kadrowanie zapisane
              </span>
            )}
            {frameDirty && !savingFrame && (
              <span className="text-[10px] text-amber-600 font-semibold uppercase tracking-wide">
                Niezapisane zmiany
              </span>
            )}
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
    </div>
  );
};
