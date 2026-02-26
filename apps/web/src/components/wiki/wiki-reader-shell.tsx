import type { ReactNode } from 'react';
import Link from 'next/link';
import type { StoredWikiContract } from '@wikismith/contracts';
import type { IWikiPage } from '@wikismith/shared';
import { Badge } from '@/components/ui/badge';
import { LiveWikiLink } from '@/components/navigation/live-wiki-link';
import { WikiSidebar } from '@/components/wiki/sidebar';
import { WikiPageContent } from '@/components/wiki/page-content';

interface WikiReaderShellProps {
  wiki: StoredWikiContract;
  slug: string;
  basePath: string;
  headerActions?: ReactNode;
  showMetrics?: boolean;
}

const getCurrentPage = (wiki: StoredWikiContract, slug: string): IWikiPage | undefined =>
  wiki.pages.find((page) => page.slug === slug) ??
  wiki.pages.find((page) => page.slug === 'overview');

export const WikiReaderShell = ({
  wiki,
  slug,
  basePath,
  headerActions,
  showMetrics = true,
}: WikiReaderShellProps) => {
  const currentPage = getCurrentPage(wiki, slug);

  if (!currentPage) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-400">Page not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex">
      <WikiSidebar pages={wiki.pages} owner={wiki.owner} repo={wiki.repo} basePath={basePath} />
      <div className="flex-1 overflow-y-auto">
        <header className="border-b border-zinc-800 px-6 py-3 flex items-center gap-3">
          <Link href="/" className="text-blue-400 hover:underline text-sm font-medium">
            WikiSmith
          </Link>
          <span className="text-zinc-600">/</span>
          <span className="text-sm text-zinc-400">
            {wiki.owner}/{wiki.repo}
          </span>
          <div className="ml-auto flex items-center justify-end gap-2 flex-wrap">
            <LiveWikiLink />
            {headerActions}
            {showMetrics &&
              wiki.analysis.frameworks.map((framework) => (
                <Badge
                  key={framework}
                  variant="secondary"
                  className="hidden sm:inline-flex text-xs"
                >
                  {framework}
                </Badge>
              ))}
            {showMetrics && (
              <Badge variant="outline" className="hidden sm:inline-flex text-xs">
                {wiki.analysis.fileCount} files
              </Badge>
            )}
          </div>
        </header>
        <WikiPageContent page={currentPage} />
      </div>
    </div>
  );
};
