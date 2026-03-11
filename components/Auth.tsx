
import React, { useState, useRef } from 'react';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { supabase } from '../services/supabaseService';
import { ChefHat, Loader2, ArrowRight, ShieldCheck } from 'lucide-react';

interface Props {
  onDemoLogin?: () => void;
}

export const Auth: React.FC<Props> = ({ onDemoLogin }) => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<HCaptcha>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (!supabase && onDemoLogin) {
      setTimeout(() => {
        onDemoLogin();
        setLoading(false);
      }, 800);
      return;
    }

    if (!captchaToken) {
      setMessage({ type: 'error', text: 'Potwierdź, że nie jesteś robotem.' });
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        const { error } = await supabase!.auth.signUp({
          email,
          password,
          options: { captchaToken },
        });
        if (error) throw error;
        setMessage({ type: 'success', text: 'Konto restauracji utworzone! Sprawdź email.' });
      } else {
        const { error } = await supabase!.auth.signInWithPassword({
          email,
          password,
          options: { captchaToken },
        });
        if (error) throw error;
      }
      // Po udanym logowaniu / rejestracji resetujemy captcha
      captchaRef.current?.resetCaptcha();
      setCaptchaToken(null);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Błąd autoryzacji' });
      captchaRef.current?.resetCaptcha();
      setCaptchaToken(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6">
      <div className="flex items-center gap-3 mb-12">
        <div className="bg-[#FBB02D] p-3 rounded-2xl shadow-lg shadow-amber-500/20">
          <ChefHat size={40} className="text-white" />
        </div>
        <h1 className="text-4xl font-black italic text-[#0F172A] tracking-tighter">Chefvision</h1>
      </div>

      <div className="w-full max-w-[480px] bg-white border border-slate-100 p-10 md:p-14 rounded-[40px] shadow-[0_20px_60px_rgba(0,0,0,0.03)] space-y-10">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-black text-[#1E293B] tracking-tight italic">Zaloguj Restaurację</h2>
          <p className="text-slate-400 font-medium">Panel zarządzania standardami AI</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Email Biznesowy</label>
            <input 
              type="email" 
              required
              className="w-full bg-[#F8FAFC] border border-slate-100 rounded-2xl px-6 py-4 text-[#1E293B] outline-none focus:ring-2 focus:ring-[#FBB02D] transition-all font-bold"
              placeholder="biuro@twojarestauracja.pl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Hasło</label>
            <input 
              type="password" 
              required
              className="w-full bg-[#F8FAFC] border border-slate-100 rounded-2xl px-6 py-4 text-[#1E293B] outline-none focus:ring-2 focus:ring-[#FBB02D] transition-all font-bold"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {message && (
            <div className={`p-4 rounded-xl text-xs font-black uppercase tracking-tight ${message.type === 'error' ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}`}>
              {message.text}
            </div>
          )}

          {/* hCaptcha – wymagana zarówno przy logowaniu jak i rejestracji */}
          <div className="flex justify-center">
            <HCaptcha
              ref={captchaRef}
              sitekey="113419d8-b4de-46cc-8826-7062a67ab4f8"
              onVerify={(token) => setCaptchaToken(token)}
              onExpire={() => setCaptchaToken(null)}
              onError={() => setCaptchaToken(null)}
            />
          </div>

          <button 
            type="submit" 
            disabled={loading || !captchaToken}
            className="w-full bg-[#FBB02D] hover:bg-[#f3a61d] text-white font-black py-5 rounded-2xl shadow-xl shadow-amber-500/10 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed text-lg group active:scale-[0.98]"
          >
            {loading ? <Loader2 className="animate-spin" /> : (isSignUp ? 'ZAREJESTRUJ' : 'ZALOGUJ SIĘ')}
            {!loading && <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />}
          </button>
        </form>

        {!supabase && (
          <button 
            onClick={() => onDemoLogin && onDemoLogin()}
            className="w-full py-4 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 font-bold hover:bg-slate-50 transition-all text-sm flex items-center justify-center gap-2"
          >
            <ShieldCheck size={18} /> WEJDŹ DO WERSJI TESTOWEJ
          </button>
        )}

        <div className="text-center pt-2">
          <p className="text-slate-400 font-medium text-sm">
            {isSignUp ? 'Masz już konto? ' : 'Chcesz założyć konto? '}
            <button 
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-[#FBB02D] font-black hover:underline transition-colors"
            >
              {isSignUp ? 'Zaloguj się' : 'Zarejestruj się'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
