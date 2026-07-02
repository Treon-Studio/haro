'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { cn } from '@treonstudio/bungas-core/lib/utils';
import CategoryTabs from './CategoryTabs';
import SearchBar from './SearchBar';
import AgentCard from './AgentCard';
import { mockCategories } from './mockData';

interface MarketplaceProps {
  className?: string;
}

interface Agent {
  id: string;
  name: string;
  description: string;
  category: string;
  author: string;
  avatarUrl?: string;
  isPromoted: boolean;
}

const Marketplace: React.FC<MarketplaceProps> = ({ className = '' }) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [displayCategory, setDisplayCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const res = await fetch('/api/agents');
        const json = await res.json();
        if (json.success && json.data) {
          setAgents(json.data);
        }
      } catch (err) {
        console.error('Failed to fetch agents:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAgents();
  }, []);

  const filteredAgents = useMemo(() => {
    let result = agents;
    
    // Filter by category
    if (displayCategory !== 'all') {
      if (displayCategory === 'promoted') {
        result = result.filter(agent => agent.isPromoted);
      } else {
        result = result.filter(agent => agent.category === displayCategory);
      }
    }
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(agent => 
        agent.name.toLowerCase().includes(query) || 
        agent.description.toLowerCase().includes(query) ||
        agent.author.toLowerCase().includes(query)
      );
    }
    
    return result;
  }, [agents, displayCategory, searchQuery]);

  const activeCategoryData = useMemo(() => {
    if (displayCategory === 'all') {
      return { name: 'All Categories', description: 'Browse all available agents' };
    }
    if (displayCategory === 'promoted') {
      return { name: 'Top Picks', description: 'Recommended for you' };
    }
    const found = mockCategories.find(c => c.value === displayCategory);
    if (found) {
      return { name: found.label, description: found.description };
    }
    return { name: displayCategory, description: '' };
  }, [displayCategory]);

  return (
    <div className={cn('relative flex w-full grow overflow-hidden bg-presentation', className)}>
      <main className="flex h-full flex-col overflow-hidden w-full" role="main">
        {/* Scrollable container */}
        <div className="scrollbar-gutter-stable relative flex h-full w-full flex-col overflow-y-auto overflow-x-hidden">
          {/* Hero Section */}
          <div className="container mx-auto max-w-4xl px-4">
            <div className="mb-8 mt-12 text-center">
              <h1 className="mb-3 text-3xl font-bold tracking-tight text-text-primary md:text-5xl">
                Agent Marketplace
              </h1>
              <p className="mx-auto mb-6 max-w-2xl text-lg text-text-secondary">
                Discover and find agents for any task.
              </p>
            </div>
          </div>

          {/* Sticky wrapper for search bar and categories */}
          <div className="sticky top-0 z-10 mt-4 bg-presentation pb-4 md:mt-0">
            <div className="container mx-auto max-w-4xl px-4">
              {/* Search bar */}
              <div className="mx-auto flex max-w-2xl gap-2 pb-6">
                <SearchBar value={searchQuery} onSearch={setSearchQuery} />
              </div>

              {/* Category tabs */}
              <CategoryTabs
                categories={mockCategories}
                activeTab={displayCategory}
                isLoading={isLoading}
                onChange={setDisplayCategory}
              />
            </div>
          </div>

          {/* Scrollable content area */}
          <div className="container mx-auto max-w-4xl px-4 pb-8">
            <div className="relative overflow-hidden">
              <div key={`pane-current-${displayCategory}`}>
                {/* Category header - only show when not searching */}
                {!searchQuery && (
                  <div className="mb-6 mt-6">
                    <div className="text-left">
                      <h2 className="text-2xl font-bold text-text-primary">{activeCategoryData.name}</h2>
                      {activeCategoryData.description && (
                        <p className="mt-2 text-text-secondary">{activeCategoryData.description}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Agent grid */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredAgents.map(agent => {
                    const catLabel = mockCategories.find(c => c.value === agent.category)?.label;
                    return (
                      <AgentCard 
                        key={agent.id} 
                        agent={agent as any} 
                        categoryLabel={catLabel} 
                      />
                    );
                  })}
                </div>
                
                {!isLoading && filteredAgents.length === 0 && (
                  <div className="py-12 text-center text-text-secondary">
                    No agents found matching your criteria.
                  </div>
                )}
                
                {isLoading && (
                  <div className="py-12 text-center text-text-secondary">
                    Loading agents...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Marketplace;
