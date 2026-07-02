'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { MagniferLinear, CloseCircleLinear } from 'solar-icon-set';;
import { Input } from '@treonstudio/bungas-core/ui/input';

interface SearchBarProps {
  value: string;
  onSearch: (query: string) => void;
  className?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({ value, onSearch, className = '' }) => {
  const [searchTerm, setSearchTerm] = useState(value);

  useEffect(() => {
    setSearchTerm(value);
  }, [value]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchTerm !== value) {
        onSearch(searchTerm);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm, onSearch, value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleClear = useCallback(() => {
    onSearch('');
    setSearchTerm('');
  }, [onSearch]);

  return (
    <div className={`relative w-full max-w-4xl ${className}`} role="search">
      <label htmlFor="agent-search" className="sr-only">
        MagniferLinear agents
      </label>
      <Input
        id="agent-search"
        type="text"
        value={searchTerm}
        onChange={handleChange}
        placeholder="Search agents..."
        className="h-12 rounded-xl border-border-medium bg-transparent pl-12 pr-12 text-lg text-text-primary shadow-md transition-[border-color,box-shadow] duration-200 placeholder:text-text-secondary focus:border-border-heavy focus:shadow-lg focus:ring-0"
        aria-label="Search agents"
        aria-describedby="search-instructions search-results-count"
        autoComplete="off"
        spellCheck="false"
      />

      <div className="absolute inset-y-0 left-0 flex items-center pl-4" aria-hidden="true">
        <MagniferLinear className="size-5 text-text-secondary" />
      </div>
      <div id="search-instructions" className="sr-only">
        Type to search agents.
      </div>
      {searchTerm && (
        <button
          type="button"
          onClick={handleClear}
          className="group absolute right-4 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label="Clear search"
          title="Clear search"
        >
          <CloseCircleLinear
            className="size-5 text-text-secondary transition-colors duration-200 group-hover:text-text-primary"
            strokeWidth={2.5}
            aria-hidden="true"
          />
        </button>
      )}
    </div>
  );
};

export default SearchBar;
