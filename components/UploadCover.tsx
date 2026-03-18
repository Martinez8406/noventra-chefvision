import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseService';
import { Loader2, ImagePlus, CheckCircle, X } from 'lucide-react';

interface Props {
  userId: string;
}

export const UploadCover: React.FC<Props> = ({ userId }) => {
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!supabase || !userId) return;
    supabase
      .from('profiles')
      .select('cover_url')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (data?.cover_url) setCoverUrl(data.cover_url);
      });
  }, [userId]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !supabase) return;

    if (!file.type.startsWith('image/')) {
      setError('Wybierz plik graficzny (JPG, PNG, WebP…)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Plik jest za duży (max 5 MB).');
      return;
    }

    setError(null);
    setSuccess(false);
    setUploading(true);

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

      const { error: dbError } = await supabase
        .from('profiles')
        .update({ cover_url: publicUrl })
        .eq('id', userId);

      if (dbError) throw dbError;

      setCoverUrl(publicUrl);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Błąd przesyłania zdjęcia cover.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!supabase) return;
    await supabase.from('profiles').update({ cover_url: null }).eq('id', userId);
    setCoverUrl(null);
  };

  return (
    <div className="space-y-4">
      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">
        Zdjęcie cover (widoczne na górze Live Menu)
      </label>

      <div className="flex items-center gap-4">
        {/* Podgląd */}
        {coverUrl ? (
          <div className="relative w-32 h-20 flex-shrink-0">
            <img
              src={coverUrl}
              alt="Cover menu"
              className="w-32 h-20 object-cover rounded-2xl border border-slate-100"
            />
            <button
              type="button"
              onClick={handleRemove}
              className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
              title="Usuń cover"
            >
              <X size={10} />
            </button>
          </div>
        ) : (
          <div className="w-32 h-20 flex-shrink-0 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50 text-slate-300">
            <ImagePlus size={24} />
          </div>
        )}

        {/* Przycisk uploadu */}
        <div className="flex flex-col gap-2">
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
              <><Loader2 size={14} className="animate-spin" /> Przesyłanie…</>
            ) : (
              <><ImagePlus size={14} /> {coverUrl ? 'Zmień cover' : 'Wgraj cover'}</>
            )}
          </button>
          {success && (
            <span className="flex items-center gap-1 text-xs text-green-600 font-semibold">
              <CheckCircle size={13} /> Cover zapisany!
            </span>
          )}
          <p className="text-[10px] text-slate-400">JPG, PNG, WebP – max 5 MB</p>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-500 font-medium">{error}</p>
      )}
    </div>
  );
};
