'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { WikiSidebar } from '@/components/wiki/sidebar';
import { WikiPageContent } from '@/components/wiki/page-content';
import type { StoredWiki } from '@/lib/wiki-store';
import type { IWikiPage } from '@wikismith/shared';
import { Badge } from '@/components/ui/badge';

const WikiPage = () => {
  const params = useParams<{ owner: string; repo: string; slug?: string[] }>();
  const [wiki, setWiki] = useState<StoredWiki | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const owner = params.owner;
  const repo = params.repo;
  const slug = params.slug?.[0] ?? 'overview';

  useEffect(() => {
    const fetchWiki = async () => {
      try {
        const response = await fetch(`/api/wiki/${owner}/${repo}`);
        if (!response.ok) {
          setError('Wiki not found. Generate it first from the homepage.');
          return;
        }
        const data = (await response.json()) as StoredWiki;
        setWiki(data);
      } catch {
        setError('Failed to load wiki.');
      } finally {
        setLoading(false);
      }
    };
    fetchWiki();
  }, [owner, repo]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex items-center gap-3 text-zinc-400">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Loading wiki...
        </div>
      </div>
    );
  }

  if (error !== null || !wiki) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400 text-lg">{error ?? 'Wiki not found'}</p>
          <Link href="/" className="text-blue-400 hover:underline mt-4 inline-block">
            Go back home
          </Link>
        </div>
      </div>
    );
  }

  const currentPage: IWikiPage | undefined =
    wiki.pages.find((p) => p.slug === slug) ?? wiki.pages.find((p) => p.slug === 'overview');

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
          <div className="ml-auto flex items-center gap-2">
            {wiki.analysis.frameworks.map((fw) => (
              <Badge key={fw} variant="secondary" className="text-xs">
                {fw}
              </Badge>
            ))}
            <Badge variant="outline" className="text-xs">
              {wiki.analysis.fileCount} files
            </Badge>
          </div>
        </header>
        <WikiPageContent page={currentPage} />
      </div>
    </div>
  );
};

export default WikiPage;
