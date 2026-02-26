'use client';

import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { WikiReaderShell } from '@/components/wiki/wiki-reader-shell';
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

  return (
    <WikiReaderShell
      wiki={wiki}
      slug={slug}
      basePath={`/wiki/${owner}/${repo}`}
      headerActions={headerActions}
    />
  );
};
