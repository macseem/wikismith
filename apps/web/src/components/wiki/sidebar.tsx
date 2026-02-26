'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { IWikiPage } from '@wikismith/shared';

interface SidebarProps {
  pages: IWikiPage[];
  owner: string;
  repo: string;
}

export const WikiSidebar = ({ pages, owner, repo }: SidebarProps) => {
  const pathname = usePathname();
  const basePath = `/wiki/${owner}/${repo}`;

  const overview = pages.find((p) => p.slug === 'overview');
  const overviewId = overview?.id ?? null;
  const topLevel = pages
    .filter((p) => p.parentPageId === overviewId)
    .sort((a, b) => a.order - b.order);

  return (
    <nav className="w-64 shrink-0 border-r border-zinc-800 bg-zinc-950 p-4 overflow-y-auto">
      <Link href={basePath} className="block mb-6">
        <h2 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">
          {owner}/{repo}
        </h2>
      </Link>

      <ul className="space-y-1">
        {overview && (
          <li>
            <Link
              href={basePath}
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
              <Link
                href={href}
                className={cn(
                  'block px-3 py-2 rounded-md text-sm transition-colors',
                  isActive
                    ? 'bg-zinc-800 text-white font-medium'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50',
                )}
              >
                {page.title}
              </Link>
              {children.length > 0 && (
                <ul className="ml-4 mt-1 space-y-1">
                  {children.map((child) => {
                    const childHref = `${basePath}/${child.slug}`;
                    const childActive = pathname === childHref;
                    return (
                      <li key={child.id}>
                        <Link
                          href={childHref}
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
