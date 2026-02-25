import React from 'react';

interface Props {
  children: React.ReactNode;
  show?: boolean;
  className?: string;
}

/**
 * Nakłada znak wodny „Powered by noventralabs.com” w prawym dolnym rogu kontenera.
 * Używany dla użytkowników nie-Premium.
 */
export const WatermarkWrapper: React.FC<Props> = ({ children, show, className }) => {
  return (
    <div className={`relative ${className ?? ''}`}>
      {children}
      {show && (
        <div className="pointer-events-none absolute bottom-3 right-3 text-[10px] font-semibold text-white/60 drop-shadow-md">
          Powered by <span className="font-bold">noventralabs.com</span>
        </div>
      )}
    </div>
  );
};

