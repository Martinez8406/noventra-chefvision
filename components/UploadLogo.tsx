import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseService';
import { Loader2, ImagePlus, CheckCircle, Save } from 'lucide-react';
import { MenuHeroIdentityPreview } from './MenuHeroIdentityPreview';
import { ImageFrameControls } from './ImageFrameControls';
import {
  DEFAULT_LOGO_POSITION,
  DEFAULT_LOGO_SCALE,
  MAX_LOGO_SCALE,
  MIN_LOGO_SCALE,
  normalizeLogoPosition,
  normalizeLogoScale,
  isMissingLogoFrameColumns,
  type LogoObjectPosition,
} from '../utils/logoFrame';
import {
  DEFAULT_COVER_POSITION,
  DEFAULT_COVER_SCALE,
  isMissingCoverFrameColumns,
  normalizeCoverPosition,
  normalizeCoverScale,
  type CoverObjectPosition,
} from '../utils/coverFrame';

function isMissingFrameColumns(error: { code?: string; message?: string } | null): boolean {
  return isMissingLogoFrameColumns(error) || isMissingCoverFrameColumns(error);
}

type FrameTarget = 'logo' | 'cover';

interface Props {
  userId: string;
  restaurantName?: string;
}

export const UploadLogo: React.FC<Props> = ({ userId, restaurantName: restaurantNameProp }) => {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [frameTarget, setFrameTarget] = useState<FrameTarget>('logo');
  const [logoPosition, setLogoPosition] = useState<LogoObjectPosition>(DEFAULT_LOGO_POSITION);
  const [logoScale, setLogoScale] = useState(DEFAULT_LOGO_SCALE);
  const [savedLogoPosition, setSavedLogoPosition] = useState<LogoObjectPosition>(DEFAULT_LOGO_POSITION);
  const [savedLogoScale, setSavedLogoScale] = useState(DEFAULT_LOGO_SCALE);
  const [coverPosition, setCoverPosition] = useState<CoverObjectPosition>(DEFAULT_COVER_POSITION);
  const [coverScale, setCoverScale] = useState(DEFAULT_COVER_SCALE);
  const [savedCoverPosition, setSavedCoverPosition] = useState<CoverObjectPosition>(DEFAULT_COVER_POSITION);
  const [savedCoverScale, setSavedCoverScale] = useState(DEFAULT_COVER_SCALE);
  const [primaryColor, setPrimaryColor] = useState('#6366f1');
  const [restaurantName, setRestaurantName] = useState(restaurantNameProp?.trim() || 'Twoja Restauracja');

  const [uploading, setUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [savingFrame, setSavingFrame] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [coverSuccess, setCoverSuccess] = useState(false);
  const [frameColumnsAvailable, setFrameColumnsAvailable] = useState(true);
  const [frameSaved, setFrameSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const logoFrameDirty =
    !!logoUrl &&
    (logoPosition !== savedLogoPosition || Math.abs(logoScale - savedLogoScale) > 0.001);
  const coverFrameDirty =
    !!coverUrl &&
    (coverPosition !== savedCoverPosition || Math.abs(coverScale - savedCoverScale) > 0.001);
  const frameDirty = logoFrameDirty || coverFrameDirty;

  const activeFrameDirty = frameTarget === 'logo' ? logoFrameDirty : coverFrameDirty;
  const canEditActiveFrame = frameTarget === 'logo' ? !!logoUrl : !!coverUrl;

  useEffect(() => {
    if (restaurantNameProp?.trim()) setRestaurantName(restaurantNameProp.trim());
  }, [restaurantNameProp]);

  useEffect(() => {
    if (frameTarget === 'logo' && !logoUrl && coverUrl) setFrameTarget('cover');
    if (frameTarget === 'cover' && !coverUrl && logoUrl) setFrameTarget('logo');
  }, [frameTarget, logoUrl, coverUrl]);

  useEffect(() => {
    if (!supabase || !userId) return;

    const loadProfile = async () => {
      const { error: schemaProbeError } = await supabase
        .from('profiles')
        .select('logo_object_position, logo_scale, cover_object_position, cover_scale')
        .limit(0);

      const frameOk = !isMissingFrameColumns(schemaProbeError);
      setFrameColumnsAvailable(frameOk);

      const selectFields = frameOk
        ? 'logo_url, logo_object_position, logo_scale, cover_url, cover_object_position, cover_scale, primary_color, restaurant_name'
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
        const row = data as {
          logo_object_position?: string;
          logo_scale?: number;
          cover_object_position?: string;
          cover_scale?: number;
        };
        const lPos = normalizeLogoPosition(row.logo_object_position);
        const lScale = normalizeLogoScale(row.logo_scale);
        setLogoPosition(lPos);
        setSavedLogoPosition(lPos);
        setLogoScale(lScale);
        setSavedLogoScale(lScale);

        const cPos = normalizeCoverPosition(row.cover_object_position);
        const cScale = normalizeCoverScale(row.cover_scale);
        setCoverPosition(cPos);
        setSavedCoverPosition(cPos);
        setCoverScale(cScale);
        setSavedCoverScale(cScale);
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

      const logoPatch = {
        logo_url: publicUrl,
        logo_object_position: DEFAULT_LOGO_POSITION,
        logo_scale: DEFAULT_LOGO_SCALE,
      };
      const { error: dbError } = await supabase.from('profiles').update(logoPatch).eq('id', userId);

      if (dbError) {
        const { error: dbError2 } = await supabase
          .from('profiles')
          .update({ logo_url: publicUrl })
          .eq('id', userId);
        if (dbError2) throw dbError2;
      }

      setLogoUrl(publicUrl);
      setFrameTarget('logo');
      setLogoPosition(DEFAULT_LOGO_POSITION);
      setSavedLogoPosition(DEFAULT_LOGO_POSITION);
      setLogoScale(DEFAULT_LOGO_SCALE);
      setSavedLogoScale(DEFAULT_LOGO_SCALE);
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
    setSavedLogoPosition(DEFAULT_LOGO_POSITION);
    setLogoScale(DEFAULT_LOGO_SCALE);
    setSavedLogoScale(DEFAULT_LOGO_SCALE);
  };

  const handleCoverFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !supabase) return;

    if (!file.type.startsWith('image/')) {
      setError('Wybierz plik graficzny (JPG, PNG, WebP…)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Plik cover jest za duży (max 5 MB).');
      return;
    }

    setError(null);
    setCoverSuccess(false);
    setCoverUploading(true);

    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const filePath = `${userId}/cover.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('restaurant-covers')
        .upload(filePath, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('restaurant-covers')
        .getPublicUrl(`${userId}/cover.${ext}`);

      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const coverPatch = {
        cover_url: publicUrl,
        cover_object_position: DEFAULT_COVER_POSITION,
        cover_scale: DEFAULT_COVER_SCALE,
      };
      const { error: dbError } = await supabase.from('profiles').update(coverPatch).eq('id', userId);

      if (dbError) {
        const { error: dbError2 } = await supabase
          .from('profiles')
          .update({ cover_url: publicUrl })
          .eq('id', userId);
        if (dbError2) throw dbError2;
      }

      setCoverUrl(publicUrl);
      setFrameTarget('cover');
      setCoverPosition(DEFAULT_COVER_POSITION);
      setSavedCoverPosition(DEFAULT_COVER_POSITION);
      setCoverScale(DEFAULT_COVER_SCALE);
      setSavedCoverScale(DEFAULT_COVER_SCALE);
      setCoverSuccess(true);
      setTimeout(() => setCoverSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Błąd przesyłania zdjęcia cover.');
    } finally {
      setCoverUploading(false);
    }
  };

  const handleCoverRemove = async () => {
    if (!supabase) return;
    await supabase
      .from('profiles')
      .update({
        cover_url: null,
        cover_object_position: DEFAULT_COVER_POSITION,
        cover_scale: DEFAULT_COVER_SCALE,
      })
      .eq('id', userId);
    setCoverUrl(null);
    setCoverPosition(DEFAULT_COVER_POSITION);
    setSavedCoverPosition(DEFAULT_COVER_POSITION);
    setCoverScale(DEFAULT_COVER_SCALE);
    setSavedCoverScale(DEFAULT_COVER_SCALE);
  };

  const handleSaveFrame = async () => {
    if (!supabase || !frameDirty) return;
    setSavingFrame(true);
    setError(null);
    setFrameSaved(false);
    try {
      const patch: Record<string, string | number> = {};
      if (logoFrameDirty) {
        patch.logo_object_position = logoPosition;
        patch.logo_scale = logoScale;
      }
      if (coverFrameDirty) {
        patch.cover_object_position = coverPosition;
        patch.cover_scale = coverScale;
      }

      const { error: dbError } = await supabase.from('profiles').update(patch).eq('id', userId);

      if (dbError) {
        if (isMissingFrameColumns(dbError)) {
          setFrameColumnsAvailable(false);
          throw new Error(
            'Kolumny kadrowania nie są widoczne w API. Uruchom migrację SQL (poniżej), potem w Supabase: Settings → API → Reload schema (lub odczekaj 1–2 min) i odśwież F5.'
          );
        }
        throw new Error(`Nie udało się zapisać kadrowania: ${dbError.message}`);
      }

      setFrameColumnsAvailable(true);
      if (logoFrameDirty) {
        setSavedLogoPosition(logoPosition);
        setSavedLogoScale(logoScale);
      }
      if (coverFrameDirty) {
        setSavedCoverPosition(coverPosition);
        setSavedCoverScale(coverScale);
      }
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
          Logo i zdjęcie cover (widoczne w Live Menu)
        </label>
        <p className="text-xs text-slate-500 mt-1">
          Wgraj logo i zdjęcie tła na górze menu. Wybierz element (logo lub cover) i ustaw jego kadrowanie — podgląd
          poniżej wygląda tak samo jak w menu publicznym.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
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
          <p className="text-[10px] text-slate-400 w-full sm:w-auto">Logo: PNG, JPG — max 2 MB</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleCoverFile}
          />
          <button
            type="button"
            onClick={() => coverInputRef.current?.click()}
            disabled={coverUploading}
            className="px-5 py-2.5 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {coverUploading ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Przesyłanie…
              </>
            ) : (
              <>
                <ImagePlus size={14} /> {coverUrl ? 'Zmień cover' : 'Wgraj cover'}
              </>
            )}
          </button>
          {coverUrl && (
            <button
              type="button"
              onClick={() => void handleCoverRemove()}
              className="px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
            >
              Usuń cover
            </button>
          )}
          {coverSuccess && (
            <span className="flex items-center gap-1 text-xs text-green-600 font-semibold">
              <CheckCircle size={13} /> Cover wgrany!
            </span>
          )}
          <p className="text-[10px] text-slate-400 w-full sm:w-auto">Cover: JPG, PNG, WebP — max 5 MB</p>
        </div>
      </div>

      {(logoUrl || coverUrl) && !frameColumnsAvailable && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 space-y-2">
          <p className="font-bold">Jednorazowa konfiguracja bazy (Supabase)</p>
          <p className="text-xs leading-relaxed">
            Aby zapisać kadrowanie, uruchom w <strong>Supabase → SQL Editor</strong> skrypty z folderu{' '}
            <code className="text-[10px]">supabase/</code> (logo i cover), np.:
          </p>
          <pre className="text-[10px] bg-white border border-amber-100 rounded-xl p-3 overflow-x-auto whitespace-pre-wrap font-mono">
{`-- logo_frame_settings.sql + cover_frame_settings.sql
alter table public.profiles
  add column if not exists logo_object_position text not null default 'center',
  add column if not exists logo_scale numeric not null default 1,
  add column if not exists cover_object_position text not null default 'center',
  add column if not exists cover_scale numeric not null default 1;`}
          </pre>
          <p className="text-[10px] text-amber-800 leading-relaxed">
            Po uruchomieniu: Supabase → <strong>Settings → API → Reload schema</strong> (jeśli jest), potem{' '}
            <strong>F5</strong> w aplikacji. Upewnij się, że SQL uruchomiłeś w tym samym projekcie co w pliku .env.
          </p>
        </div>
      )}

      {(logoUrl || coverUrl) && (
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
                coverPosition={coverPosition}
                coverScale={coverScale}
                primaryColor={primaryColor}
                compactCover
              />
            </div>
          </div>

          {frameColumnsAvailable && (logoUrl || coverUrl) && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                  Kadruj element
                </p>
                <div
                  className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5 shadow-sm"
                  role="tablist"
                  aria-label="Wybór elementu do kadrowania"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={frameTarget === 'logo'}
                    disabled={!logoUrl}
                    onClick={() => setFrameTarget('logo')}
                    className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                      frameTarget === 'logo'
                        ? 'bg-chef-dark text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed'
                    }`}
                  >
                    Logo
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={frameTarget === 'cover'}
                    disabled={!coverUrl}
                    onClick={() => setFrameTarget('cover')}
                    className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                      frameTarget === 'cover'
                        ? 'bg-chef-dark text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed'
                    }`}
                  >
                    Cover
                  </button>
                </div>
                {activeFrameDirty && (
                  <span className="text-[10px] text-amber-600 font-semibold uppercase tracking-wide">
                    Niezapisane zmiany ({frameTarget === 'logo' ? 'logo' : 'cover'})
                  </span>
                )}
              </div>

              {canEditActiveFrame ? (
                <ImageFrameControls
                  title={frameTarget === 'logo' ? 'Logo' : 'Cover'}
                  position={frameTarget === 'logo' ? logoPosition : coverPosition}
                  scale={frameTarget === 'logo' ? logoScale : coverScale}
                  minScale={MIN_LOGO_SCALE}
                  maxScale={MAX_LOGO_SCALE}
                  onPositionChange={
                    frameTarget === 'logo' ? setLogoPosition : setCoverPosition
                  }
                  onScaleChange={frameTarget === 'logo' ? setLogoScale : setCoverScale}
                  scaleHelp={
                    frameTarget === 'logo'
                      ? 'Kadrowanie logo. Przesuń w lewo, aby pomniejszyć; punkt kadrowania ustawia widoczny fragment przy powiększeniu.'
                      : 'Kadrowanie zdjęcia cover. Przesuń w lewo, aby pomniejszyć; punkt kadrowania wybiera widoczny fragment banera.'
                  }
                />
              ) : (
                <p className="text-xs text-slate-500">
                  Wgraj {frameTarget === 'logo' ? 'logo' : 'zdjęcie cover'}, aby ustawić kadrowanie.
                </p>
              )}

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
                {frameDirty && !savingFrame && !activeFrameDirty && (
                  <span className="text-[10px] text-amber-600 font-semibold uppercase tracking-wide">
                    Niezapisane zmiany w drugim elemencie
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
    </div>
  );
};
