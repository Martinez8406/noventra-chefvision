import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../services/supabaseService';
import { BarChart3, CalendarDays, RefreshCw, Users } from 'lucide-react';

interface Props {
  userId: string | null;
}

interface MenuOpenStats {
  daily: number;
  monthly: number;
  today: string;
  month: string;
  dailySeries: { date: string; opens: number }[];
}

export const MenuStatsPanel: React.FC<Props> = ({ userId }) => {
  const { t } = useTranslation('stats');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<MenuOpenStats | null>(null);

  const loadStats = async (isManualRefresh = false) => {
    if (!userId) {
      setLoading(false);
      setStats(null);
      return;
    }

    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const headers: Record<string, string> = {};
      if (supabase) {
        await supabase.auth.getUser();
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`/api/get-menu-open-stats?userId=${encodeURIComponent(userId)}`, {
        method: 'GET',
        headers,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || `HTTP ${response.status}`);
      }
      setStats({
        daily: Number(data?.daily ?? 0),
        monthly: Number(data?.monthly ?? 0),
        today: String(data?.today ?? ''),
        month: String(data?.month ?? ''),
        dailySeries: Array.isArray(data?.dailySeries)
          ? data.dailySeries.map((x: any) => ({
              date: String(x?.date ?? ''),
              opens: Number(x?.opens ?? 0),
            }))
          : [],
      });
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadStats();
  }, [userId]);

  const dailySeries = stats?.dailySeries ?? [];
  const maxOpens = Math.max(1, ...dailySeries.map((x) => x.opens));
  const chartWidth = 720;
  const chartHeight = 220;
  const padX = 24;
  const padY = 24;
  const innerW = chartWidth - padX * 2;
  const innerH = chartHeight - padY * 2;
  const points = dailySeries.map((point, idx) => {
    const x = padX + (dailySeries.length <= 1 ? 0 : (idx / (dailySeries.length - 1)) * innerW);
    const y = padY + (1 - point.opens / maxOpens) * innerH;
    return { ...point, x, y };
  });
  const lineD = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight italic">{t('title')}</h2>
          <p className="text-slate-500 text-sm mt-1">{t('subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => void loadStats(true)}
          disabled={refreshing || loading || !userId}
          className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          {t('refresh')}
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 text-slate-500 font-medium">
          {t('loading')}
        </div>
      ) : error ? (
        <div className="bg-white rounded-3xl border border-red-100 shadow-sm p-8 text-red-600 font-semibold">
          {error}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-7">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">{t('cards.today')}</span>
                <CalendarDays size={18} className="text-indigo-500" />
              </div>
              <p className="text-4xl font-black text-slate-900 tabular-nums">{stats?.daily ?? 0}</p>
              <p className="text-sm text-slate-500 mt-2">{t('cards.todayHint', { date: stats?.today || '—' })}</p>
            </div>

            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-7">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">{t('cards.month')}</span>
                <Users size={18} className="text-emerald-500" />
              </div>
              <p className="text-4xl font-black text-slate-900 tabular-nums">{stats?.monthly ?? 0}</p>
              <p className="text-sm text-slate-500 mt-2">{t('cards.monthHint', { month: stats?.month || '—' })}</p>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-7">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">{t('chart.title')}</span>
              <BarChart3 size={18} className="text-indigo-500" />
            </div>
            {points.length === 0 ? (
              <p className="text-sm text-slate-500">{t('chart.empty')}</p>
            ) : (
              <>
                <div className="w-full overflow-x-auto">
                  <svg
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                    className="w-full min-w-[620px] h-[220px]"
                    role="img"
                    aria-label={t('chart.ariaLabel')}
                  >
                    <rect x="0" y="0" width={chartWidth} height={chartHeight} fill="white" />
                    {[0, 0.25, 0.5, 0.75, 1].map((tVal, idx) => {
                      const y = padY + tVal * innerH;
                      return (
                        <line
                          key={`grid-${idx}`}
                          x1={padX}
                          y1={y}
                          x2={padX + innerW}
                          y2={y}
                          stroke="#e2e8f0"
                          strokeWidth="1"
                        />
                      );
                    })}
                    <path
                      d={`${lineD} L ${padX + innerW} ${padY + innerH} L ${padX} ${padY + innerH} Z`}
                      fill="url(#opensGradient)"
                      opacity="0.2"
                    />
                    <polyline
                      fill="none"
                      stroke="#4f46e5"
                      strokeWidth="3"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      points={points.map((p) => `${p.x},${p.y}`).join(' ')}
                    />
                    {points.map((p, idx) => (
                      <circle key={`pt-${idx}`} cx={p.x} cy={p.y} r="3.5" fill="#4f46e5" />
                    ))}
                    <defs>
                      <linearGradient id="opensGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4f46e5" />
                        <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-400 font-medium">
                  <span>{points[0]?.date || ''}</span>
                  <span>{points[points.length - 1]?.date || ''}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 text-sm text-slate-500 flex items-start gap-3">
        <BarChart3 size={18} className="text-slate-400 mt-0.5 shrink-0" />
        <p>{t('footnote')}</p>
      </div>
    </div>
  );
};
