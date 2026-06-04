import React from 'react';
import { VIDEO_LINK_BANNER_SRC } from '../constants';

const VIDEO_LINK_GLOW_CSS = `
  @keyframes videoLinkGoldGlow {
    0%, 100% { box-shadow: 0 0 10px rgba(255, 200, 100, 0.3); }
    50% { box-shadow: 0 0 10px rgba(255, 200, 100, 0.7); }
  }
  .video-link-cta {
    animation: videoLinkGoldGlow 3.2s ease-in-out infinite;
  }
  @media (prefers-reduced-motion: reduce) {
    .video-link-cta {
      animation: none;
      box-shadow: 0 0 10px rgba(255, 200, 100, 0.3);
    }
  }
`;

interface Props {
  href: string;
  className?: string;
  wrapperClassName?: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

export const SocialLinkButton: React.FC<Props> = ({
  href,
  className = '',
  wrapperClassName,
  onClick,
}) => {
  const link = (
    <>
      <style>{VIDEO_LINK_GLOW_CSS}</style>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        className={`video-link-cta block rounded-2xl transition-transform duration-200 ease-out hover:-translate-y-0.5 active:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500/60 ${className}`.trim()}
        aria-label="Video Link — Zobacz danie w social mediach"
      >
        <img
          src={VIDEO_LINK_BANNER_SRC}
          alt="Video Link — Zobacz danie w social mediach"
          className="w-full h-auto block rounded-2xl"
          loading="lazy"
        />
      </a>
    </>
  );

  if (wrapperClassName) {
    return <div className={wrapperClassName}>{link}</div>;
  }

  return link;
};
