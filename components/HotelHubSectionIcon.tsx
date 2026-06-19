import React from 'react';
import { HOTEL_HUB_ICON_SRC } from '../constants';

interface Props {
  icon?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  alt?: string;
}

const SIZE_CLASS: Record<NonNullable<Props['size']>, string> = {
  sm: 'w-5 h-5',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
};

/** Ikona sekcji Hotel Hub — wspólna ikona hotelu dla wszystkich sekcji. */
export const HotelHubSectionIcon: React.FC<Props> = ({
  size = 'md',
  className = '',
  alt = 'Hotel',
}) => (
  <img
    src={HOTEL_HUB_ICON_SRC}
    alt={alt}
    className={`object-contain shrink-0 ${SIZE_CLASS[size]} ${className}`}
    draggable={false}
  />
);

export function normalizeHotelHubSectionIcon(): string {
  return HOTEL_HUB_ICON_SRC;
}
