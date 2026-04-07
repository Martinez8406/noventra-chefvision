
import React, { useState } from 'react';
import { supabase } from '../services/supabaseService';
import { BRAND_LOGO_SRC } from '../constants';
import { Loader2, Mail, ShieldCheck, CheckCircle } from 'lucide-react';

interface Props {
  onDemoLogin?: () => void;
}

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

export const Auth: React.FC<Props> = ({ onDemoLogin }) => {
  const [loading, setLoading] = useState<'magic' | 'google' | null>(null);
  const [email, setEmail] = useState('');
  const [magicSent, setMagicSent] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!supabase && onDemoLogin) {
      setLoading('magic');
      setTimeout(() => {
        onDemoLogin();
        setLoading(null);
      }, 800);
      return;
    }

    setLoading('magic');
    try {
      const { error } = await supabase!.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
        },
      });
      if (error) throw error;
      setMagicSent(true);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Błąd wysyłania linku.' });
    } finally {
      setLoading(null);
    }
  };

  const handleGoogle = async () => {
    if (!supabase) return;
    setMessage(null);
    setLoading('google');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Błąd logowania przez Google.' });
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6">
      <div className="flex items-center gap-3 mb-12">
        <img
          src={BRAND_LOGO_SRC}
          alt=""
          width={64}
          height={64}
          className="h-16 w-16 rounded-2xl shadow-lg shadow-chef-gold/20 object-cover shrink-0"
        />
        <h1 className="text-4xl font-black italic text-[#0F172A] tracking-tighter">Chefvision</h1>
      </div>

      <div className="w-full max-w-[480px] bg-white border border-slate-100 p-10 md:p-14 rounded-[40px] shadow-[0_20px_60px_rgba(0,0,0,0.03)] space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-black text-[#1E293B] tracking-tight italic">
            Zaloguj Restaurację
          </h2>
          <p className="text-slate-400 font-medium">Panel zarządzania standardami AI</p>
        </div>

        {magicSent ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
              <CheckCircle size={32} className="text-green-500" />
            </div>
            <div className="space-y-1">
              <p className="text-[#1E293B] font-black text-lg">Sprawdź skrzynkę!</p>
              <p className="text-slate-400 text-sm font-medium">
                Wysłaliśmy magic link na <span className="text-[#1E293B] font-bold">{email}</span>.
                Kliknij w link, żeby się zalogować. Sprawdź też folder SPAM.
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setMagicSent(false); setEmail(''); }}
              className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
            >
              Użyj innego emaila
            </button>
          </div>
        ) : (
          <>
            {/* Google OAuth */}
            {supabase && (
              <button
                type="button"
                onClick={handleGoogle}
                disabled={!!loading}
                className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-100 hover:border-slate-200 hover:bg-slate-50 text-[#1E293B] font-black py-4 rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                {loading === 'google' ? <Loader2 size={20} className="animate-spin" /> : <GoogleIcon />}
                KONTYNUUJ PRZEZ GOOGLE
              </button>
            )}

            {/* Separator */}
            {supabase && (
              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-slate-100" />
                <span className="text-xs font-black uppercase tracking-widest text-slate-300">lub</span>
                <div className="flex-1 h-px bg-slate-100" />
              </div>
            )}

            {/* Magic link form */}
            <form onSubmit={handleMagicLink} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  className="w-full bg-[#F8FAFC] border border-slate-100 rounded-2xl px-6 py-4 text-[#1E293B] outline-none focus:ring-2 focus:ring-[#FBB02D] transition-all font-bold"
                  placeholder="biuro@twojarestauracja.pl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {message && (
                <div className={`p-4 rounded-xl text-xs font-black uppercase tracking-tight ${message.type === 'error' ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}`}>
                  {message.text}
                </div>
              )}

              <button
                type="submit"
                disabled={!!loading}
                className="w-full bg-chef-gold hover:bg-chef-gold2 text-white font-black py-5 rounded-2xl shadow-xl shadow-chef-gold/10 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed text-lg group active:scale-[0.98]"
              >
                {loading === 'magic' ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <>
                    <Mail size={20} />
                    WYŚLIJ MAGIC LINK
                  </>
                )}
              </button>
            </form>
          </>
        )}

        {!supabase && (
          <button
            onClick={() => onDemoLogin && onDemoLogin()}
            className="w-full py-4 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 font-bold hover:bg-slate-50 transition-all text-sm flex items-center justify-center gap-2"
          >
            <ShieldCheck size={18} /> WEJDŹ DO WERSJI TESTOWEJ
          </button>
        )}
      </div>
    </div>
  );
};
