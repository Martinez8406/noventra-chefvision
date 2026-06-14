import React, { useEffect, useRef, useState } from 'react';

interface Props {
  categories: string[];
  getLabel: (category: string) => string;
  getSectionId: (category: string) => string;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  isRtl?: boolean;
}

/**
 * Poziome zakładki kategorii w menu live — między coverem a listą dań.
 * Używa kolorów i czcionki z ustawień menu; klik przewija do sekcji.
 */
export const PublicMenuCategoryTabs: React.FC<Props> = ({
  categories,
  getLabel,
  getSectionId,
  primaryColor,
  secondaryColor,
  fontFamily,
  isRtl = false,
}) => {
  const [activeCategory, setActiveCategory] = useState<string | null>(categories[0] ?? null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    if (categories.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (!visible[0]?.target.id) return;
        const match = categories.find((category) => getSectionId(category) === visible[0].target.id);
        if (match) setActiveCategory(match);
      },
      { rootMargin: '-15% 0px -55% 0px', threshold: [0, 0.15, 0.35, 0.55, 0.75] }
    );

    categories.forEach((category) => {
      const el = document.getElementById(getSectionId(category));
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [categories, getSectionId]);

  const scrollToCategory = (category: string) => {
    document.getElementById(getSectionId(category))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveCategory(category);
    tabRefs.current[category]?.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    });
  };

  if (categories.length <= 1) return null;

  return (
    <nav
      className="sticky top-0 z-[100] -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 sm:py-4"
      style={{ backgroundColor: secondaryColor }}
      aria-label="Kategorie menu"
    >
      <div
        className={`flex gap-2 overflow-x-auto pb-1 scrollbar-thin ${isRtl ? 'flex-row-reverse' : ''}`}
        style={{ scrollbarColor: `${primaryColor}40 transparent` }}
      >
        {categories.map((category) => {
          const isActive = activeCategory === category;
          return (
            <button
              key={category}
              ref={(el) => {
                tabRefs.current[category] = el;
              }}
              type="button"
              onClick={() => scrollToCategory(category)}
              aria-current={isActive ? 'true' : undefined}
              className="shrink-0 rounded-full px-4 py-2 text-xs sm:text-sm font-bold transition-all duration-200 whitespace-nowrap border"
              style={{
                fontFamily,
                backgroundColor: isActive ? primaryColor : 'transparent',
                color: isActive ? secondaryColor : primaryColor,
                borderColor: isActive ? primaryColor : `${primaryColor}40`,
              }}
            >
              {getLabel(category)}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
