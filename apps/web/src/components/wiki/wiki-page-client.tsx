'use client';

import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { WikiSidebar } from '@/components/wiki/sidebar';
import { WikiPageContent } from '@/components/wiki/page-content';
import type { IWikiPage } from '@wikismith/shared';
import { Badge } from '@/components/ui/badge';
import { apiClient, ApiClientError } from '@/lib/api/client';
import type { StoredWikiContract } from '@wikismith/contracts';

interface WikiPageClientProps {
  owner: string;
  repo: string;
  slug: string;
  headerActions: ReactNode;
}

export const WikiPageClient = ({ owner, repo, slug, headerActions }: WikiPageClientProps) => {
  const wikiQuery = useQuery({
    queryKey: ['wiki', owner, repo],
    queryFn: () => apiClient.getWiki(owner, repo),
    staleTime: 5 * 60_000,
  });
  const wiki: StoredWikiContract | null = wikiQuery.data ?? null;

  if (wikiQuery.isPending && !wiki) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex items-center gap-3 text-zinc-400">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Loading wiki...
        </div>
      </div>
    );
  }

  if (wikiQuery.isError || !wiki) {
    const errorMessage =
      wikiQuery.error instanceof ApiClientError
        ? wikiQuery.error.payload.error
        : wikiQuery.error instanceof Error
          ? wikiQuery.error.message
          : 'Wiki not found';

    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400 text-lg">{errorMessage}</p>
          <Link href="/" className="text-blue-400 hover:underline mt-4 inline-block">
            Go back home
          </Link>
        </div>
      </div>
    );
  }

  const currentPage: IWikiPage | undefined =
    wiki.pages.find((page) => page.slug === slug) ??
    wiki.pages.find((page) => page.slug === 'overview');

  if (!currentPage) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-400">Page not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex">
      <WikiSidebar pages={wiki.pages} owner={owner} repo={repo} />
      <div className="flex-1 overflow-y-auto">
        <header className="border-b border-zinc-800 px-6 py-3 flex items-center gap-3">
          <Link href="/" className="text-blue-400 hover:underline text-sm font-medium">
            WikiSmith
          </Link>
          <span className="text-zinc-600">/</span>
          <span className="text-sm text-zinc-400">
            {owner}/{repo}
          </span>
          <div className="ml-auto flex items-center justify-end gap-2 flex-wrap">
            {headerActions}
            {wiki.analysis.frameworks.map((framework) => (
              <Badge key={framework} variant="secondary" className="hidden sm:inline-flex text-xs">
                {framework}
              </Badge>
            ))}
            <Badge variant="outline" className="hidden sm:inline-flex text-xs">
              {wiki.analysis.fileCount} files
            </Badge>
          </div>
        </header>
        <WikiPageContent page={currentPage} />
      </div>
    </div>
  );
};
