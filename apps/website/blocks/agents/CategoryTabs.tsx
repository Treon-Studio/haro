'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@treonstudio/bungas-core/lib/utils';
import { Category } from './mockData';

interface CategoryTabsProps {
  categories: Category[];
  activeTab: string;
  isLoading?: boolean;
  onChange: (value: string) => void;
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);

  return matches;
}

const CategoryTabs: React.FC<CategoryTabsProps> = ({
  categories,
  activeTab,
  isLoading,
  onChange,
}) => {
  const isSmallScreen = useMediaQuery('(max-width: 768px)');

  const getCategoryDisplayName = (category: Category) => {
    return category.label || category.value.charAt(0).toUpperCase() + category.value.slice(1);
  };

  if (isLoading) {
    return (
      <div className="w-full pb-2">
        <div className="flex flex-wrap justify-center gap-1.5 px-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-[36px] min-w-[80px] animate-pulse rounded-lg bg-surface-tertiary"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!categories || categories.length === 0) {
    return <div className="text-center text-text-secondary">No categories found</div>;
  }

  return (
    <div className="w-full pb-2">
      <div
        className={cn(
          'px-4',
          isSmallScreen
            ? 'scrollbar-hide flex gap-2 overflow-x-auto scroll-smooth'
            : 'flex flex-wrap justify-center gap-1.5',
        )}
        role="tablist"
        aria-label="Category tabs"
        aria-orientation="horizontal"
        style={
          isSmallScreen
            ? {
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                WebkitOverflowScrolling: 'touch',
              }
            : undefined
        }
      >
        {categories.map((category) => (
          <button
            key={category.value}
            id={`category-tab-${category.value}`}
            onClick={() => onChange(category.value)}
            className={cn(
              'relative cursor-pointer select-none whitespace-nowrap px-3 py-2 transition-all duration-200',
              isSmallScreen ? 'min-w-fit flex-shrink-0' : '',
              activeTab === category.value
                ? 'rounded-t-lg bg-surface-hover text-text-primary'
                : 'rounded-lg bg-surface-secondary text-text-secondary hover:bg-surface-hover hover:text-text-primary active:scale-95',
            )}
            role="tab"
            aria-selected={activeTab === category.value}
            aria-controls={`tabpanel-${category.value}`}
            tabIndex={activeTab === category.value ? 0 : -1}
          >
            {getCategoryDisplayName(category)}
            {activeTab === category.value && (
              <div
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-text-primary"
                aria-hidden="true"
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default CategoryTabs;
