import React from 'react';
import { VIDEO_LINK_BANNER_SRC } from '../constants';

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
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className={`block rounded-2xl overflow-hidden transition-transform duration-200 ease-out hover:-translate-y-0.5 active:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500/60 ${className}`.trim()}
      aria-label="Video Link — Zobacz danie w social mediach"
    >
      <img
        src={VIDEO_LINK_BANNER_SRC}
        alt="Video Link — Zobacz danie w social mediach"
        className="w-full h-auto block"
        loading="lazy"
      />
    </a>
  );

  if (wrapperClassName) {
    return <div className={wrapperClassName}>{link}</div>;
  }

  return link;
};
