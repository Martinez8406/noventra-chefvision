import React from 'react';
import { useTranslation } from 'react-i18next';
import { LOGO_POSITION_GRID, type LogoObjectPosition } from '../utils/logoFrame';

interface Props {
  title: string;
  position: LogoObjectPosition;
  scale: number;
  minScale: number;
  maxScale: number;
  onPositionChange: (position: LogoObjectPosition) => void;
  onScaleChange: (scale: number) => void;
  scaleHelp: string;
}

function positionKey(id: LogoObjectPosition): string {
  return id.replace(/ /g, '_');
}

export const ImageFrameControls: React.FC<Props> = ({
  title,
  position,
  scale,
  minScale,
  maxScale,
  onPositionChange,
  onScaleChange,
  scaleHelp,
}) => {
  const { t } = useTranslation('settings');

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
          {t('frame.framingPoint', { title })}
        </p>
        <div className="grid grid-cols-3 gap-2 max-w-[220px]">
          {LOGO_POSITION_GRID.map((opt) => {
            const active = position === opt.id;
            const label = t(`frame.position.${positionKey(opt.id)}`);
            return (
              <button
                key={opt.id}
                type="button"
                title={label}
                onClick={() => onPositionChange(opt.id)}
                className={`aspect-square rounded-xl border-2 text-[9px] font-black uppercase tracking-wide transition-all ${
                  active
                    ? 'border-chef-gold bg-chef-gold/15 text-chef-dark shadow-sm'
                    : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300'
                }`}
              >
                {label.split(' ')[0]?.slice(0, 3)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">
          {t('frame.scale', { title, percent: Math.round(scale * 100) })}
        </label>
        <input
          type="range"
          min={minScale}
          max={maxScale}
          step={0.05}
          value={scale}
          onChange={(e) => onScaleChange(Number(e.target.value))}
          className="w-full max-w-xs h-2 cursor-pointer appearance-none rounded-full bg-slate-200 accent-chef-gold"
        />
        <div className="flex justify-between max-w-xs text-[9px] text-slate-400 font-semibold uppercase tracking-wide">
          <span>{minScale < 1 ? t('frame.smaller') : '100%'}</span>
          <span>100%</span>
          <span>{t('frame.larger')}</span>
        </div>
        <p className="text-[10px] text-slate-400 leading-relaxed">{scaleHelp}</p>
      </div>
    </div>
  );
};
