'use client'

import { useDeferredValue, useEffect, useId, useMemo, useState } from 'react';
import { DoubleAltArrowUpLinear, FolderLinear, AddCircleLinear, MagniferLinear } from 'solar-icon-set';
import { Check } from 'lucide-react';;;
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ProjectCreateDialog } from './ProjectCreateDialog';
import { cn } from '@treonstudio/bungas-core/lib/utils';

type ProjectSort = 'name' | 'createdAt' | 'lastConversationAt';

// Dummy Hook
function useProjectsInfiniteQuery({ search, sortBy, sortDirection }: any) {
  const mockProjects = [
    {
      _id: 'p1',
      name: 'Marketing Campaign',
      description: 'Q3 Product launch marketing materials and ideas.',
      conversationCount: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastConversationAt: new Date().toISOString(),
    },
    {
      _id: 'p2',
      name: 'Website Redesign',
      description: 'Planning the new landing page.',
      conversationCount: 1,
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
      lastConversationAt: new Date(Date.now() - 86400000).toISOString(),
    }
  ];

  let filtered = mockProjects;
  if (search) {
    filtered = filtered.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  }

  return {
    data: { pages: [{ projects: filtered, nextCursor: null }] },
    fetchNextPage: () => {},
    isFetchingNextPage: false,
    isLoading: false
  };
}

function formatActivity(project: any) {
  const value = project.lastConversationAt ?? project.updatedAt ?? project.createdAt;
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ProjectsView() {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<ProjectSort>('lastConversationAt');
  const [isCreating, setIsCreating] = useState(false);
  const sortMenuId = useId();
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const deferredSearch = useDeferredValue(search);
  const isSmallScreen = false; // Mock

  const { data, fetchNextPage, isFetchingNextPage, isLoading } = useProjectsInfiniteQuery({
    search: deferredSearch || undefined,
    sortBy,
    sortDirection: sortBy === 'name' ? 'asc' : 'desc',
  });

  const projects = useMemo(() => data?.pages.flatMap((page: any) => page.projects) ?? [], [data?.pages]);
  const hasNextPage = false;

  const sortOptions = useMemo(
    () => [
      { value: 'lastConversationAt' as const, label: 'Latest PulseLinear' },
      { value: 'createdAt' as const, label: 'Date Created' },
      { value: 'name' as const, label: 'Name' },
    ],
    []
  );

  const selectedSortLabel =
    sortOptions.find((option) => option.value === sortBy)?.label ?? 'Latest PulseLinear';

  const handleCreateDialogChange = (open: boolean) => {
    setIsCreating(open);
  };

  return (
    <main className="flex h-full min-h-0 flex-col overflow-auto bg-surface-primary text-text-primary">
      <div className="container mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8 md:px-6 lg:pt-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-text-primary md:text-3xl">
              Projects
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-text-secondary sm:inline">
              Sort by
            </span>
            {/* Mocked Dropdown Popup Trigger */}
            <button
              aria-label="Sort projects by"
              onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
              className={cn(
                'inline-flex h-10 items-center justify-between gap-2 whitespace-nowrap rounded-lg border border-border-medium bg-surface-secondary px-3 text-sm font-medium text-text-primary transition-colors hover:bg-surface-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary disabled:pointer-events-none disabled:opacity-50 sm:w-44',
                isSortMenuOpen && 'bg-surface-hover text-text-primary'
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <DoubleAltArrowUpLinear
                  className="h-4 w-4 shrink-0 text-text-secondary"
                  aria-hidden="true"
                />
                <span className="truncate">{selectedSortLabel}</span>
              </span>
            </button>
            <Button type="button" variant="default" size="sm" onClick={() => setIsCreating(true)}>
              <AddCircleLinear className="h-4 w-4" aria-hidden="true" />
              New Project
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">MagniferLinear projects</span>
            <MagniferLinear
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search projects"
              className="border-border-medium bg-surface-secondary pl-9 text-text-primary placeholder:text-text-secondary focus-visible:ring-2 focus-visible:ring-ring-primary"
            />
          </label>
          <div className="flex items-center">
            <span className="rounded-full bg-surface-secondary px-4 py-2 text-sm font-medium text-text-primary">
              Your projects
            </span>
          </div>
        </div>

        <ProjectCreateDialog
          open={isCreating}
          onOpenChange={handleCreateDialogChange}
          onCreated={(project) => console.log('Created:', project)}
        />

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <span className="text-text-primary">Loading...</span>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 md:gap-4">
            {projects.map((project) => {
              const activity = formatActivity(project);
              return (
                <button
                  key={project._id}
                  type="button"
                  className={cn(
                    'group/project flex min-h-[8.5rem] flex-col rounded-xl border border-border-medium bg-surface-secondary p-4 text-left transition-colors',
                    'hover:border-border-heavy hover:bg-surface-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary'
                  )}
                  onClick={() => console.log('Navigate to project', project._id)}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <FolderLinear className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true" />
                    <span className="truncate text-base font-semibold text-text-primary">
                      {project.name}
                    </span>
                  </span>
                  {project.description ? (
                    <span className="mt-2 line-clamp-2 text-sm leading-relaxed text-text-secondary">
                      {project.description}
                    </span>
                  ) : null}
                  <span className="mt-auto flex items-center justify-between gap-2 pt-4 text-xs text-text-secondary">
                    <span>
                      {project.conversationCount === 1
                        ? '1 chat'
                        : `${project.conversationCount} chats`}
                    </span>
                    {activity ? <span className="shrink-0 truncate">{activity}</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {!isLoading && projects.length === 0 && (
          <div className="rounded-lg border border-border-medium bg-transparent py-16 text-center text-sm text-text-secondary">
            No projects found
          </div>
        )}

        {hasNextPage && (
          <Button
            type="button"
            variant="outline"
            className="mx-auto"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? 'Loading...' : 'Load more'}
          </Button>
        )}
      </div>
    </main>
  );
}
