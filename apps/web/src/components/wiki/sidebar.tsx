'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useWikiSidebarState } from '@/lib/wiki/sidebar-state';
import type { IWikiPage } from '@wikismith/shared';

interface SidebarProps {
  pages: IWikiPage[];
  owner: string;
  repo: string;
}

export const WikiSidebar = ({ pages, owner, repo }: SidebarProps) => {
  const pathname = usePathname();
  const basePath = `/wiki/${owner}/${repo}`;
  const repoKey = `${owner}/${repo}`;
  const navRef = useRef<HTMLElement | null>(null);
  const restoredForRepoRef = useRef<string | null>(null);
  const { isGroupCollapsed, setGroupCollapsed, ensureGroupExpanded, scrollTop, setScrollTop } =
    useWikiSidebarState(repoKey);

  const pagesBySlug = useMemo(() => new Map(pages.map((page) => [page.slug, page])), [pages]);

  const overview = pages.find((p) => p.slug === 'overview');
  const overviewId = overview?.id ?? null;
  const topLevel = pages
    .filter((p) => p.parentPageId === overviewId)
    .sort((a, b) => a.order - b.order);

  const activeSlug =
    pathname === basePath
      ? 'overview'
      : pathname.startsWith(`${basePath}/`)
        ? decodeURIComponent(pathname.slice(basePath.length + 1).split('/')[0] ?? 'overview')
        : null;
  const activePage = activeSlug ? pagesBySlug.get(activeSlug) : undefined;

  useEffect(() => {
    if (!activePage?.parentPageId) {
      return;
    }

    ensureGroupExpanded(activePage.parentPageId);
  }, [activePage?.id, activePage?.parentPageId, ensureGroupExpanded]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) {
      return;
    }

    if (restoredForRepoRef.current === repoKey) {
      return;
    }

    nav.scrollTop = scrollTop;
    restoredForRepoRef.current = repoKey;
  }, [repoKey, scrollTop]);

  const handleScroll = () => {
    const nav = navRef.current;
    if (!nav) {
      return;
    }

    setScrollTop(nav.scrollTop);
  };

  return (
    <nav
      ref={navRef}
      onScroll={handleScroll}
      className="w-64 shrink-0 border-r border-zinc-800 bg-zinc-950 p-4 overflow-y-auto"
    >
      <Link href={basePath} prefetch className="block mb-6">
        <h2 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">
          {owner}/{repo}
        </h2>
      </Link>

      <ul className="space-y-1">
        {overview && (
          <li>
            <Link
              href={basePath}
              prefetch
              className={cn(
                'block px-3 py-2 rounded-md text-sm transition-colors',
                pathname === basePath
                  ? 'bg-zinc-800 text-white font-medium'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50',
              )}
            >
              {overview.title}
            </Link>
          </li>
        )}
        {topLevel.map((page) => {
          const href = page.slug === 'overview' ? basePath : `${basePath}/${page.slug}`;
          const isActive = pathname === href;
          const children = pages
            .filter((p) => p.parentPageId === page.id)
            .sort((a, b) => a.order - b.order);

          return (
            <li key={page.id}>
              <div className="flex items-center gap-1">
                <Link
                  href={href}
                  prefetch
                  className={cn(
                    'block flex-1 min-w-0 px-3 py-2 rounded-md text-sm transition-colors',
                    isActive
                      ? 'bg-zinc-800 text-white font-medium'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50',
                  )}
                >
                  <span className="truncate block">{page.title}</span>
                </Link>
                {children.length > 0 && (
                  <button
                    type="button"
                    aria-label={`${isGroupCollapsed(page.id) ? 'Expand' : 'Collapse'} ${page.title}`}
                    aria-expanded={!isGroupCollapsed(page.id)}
                    onClick={() => setGroupCollapsed(page.id, !isGroupCollapsed(page.id))}
                    className="h-8 w-8 shrink-0 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
                  >
                    <ChevronRight
                      className={cn(
                        'mx-auto h-4 w-4 transition-transform duration-150',
                        !isGroupCollapsed(page.id) && 'rotate-90',
                      )}
                    />
                  </button>
                )}
              </div>
              {children.length > 0 && !isGroupCollapsed(page.id) && (
                <ul className="ml-4 mt-1 space-y-1">
                  {children.map((child) => {
                    const childHref = `${basePath}/${child.slug}`;
                    const childActive = pathname === childHref;
                    return (
                      <li key={child.id}>
                        <Link
                          href={childHref}
                          prefetch
                          className={cn(
                            'block px-3 py-1.5 rounded-md text-xs transition-colors',
                            childActive
                              ? 'bg-zinc-800 text-white'
                              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50',
                          )}
                        >
                          {child.title}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
