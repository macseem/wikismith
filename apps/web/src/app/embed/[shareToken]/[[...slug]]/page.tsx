import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { WikiReaderShell } from '@/components/wiki/wiki-reader-shell';
import { getPublicWikiByShareToken } from '@/lib/wiki-store';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

interface EmbedWikiPageProps {
  params: Promise<{
    shareToken: string;
    slug?: string[];
  }>;
}

const EmbedWikiPage = async ({ params }: EmbedWikiPageProps) => {
  const resolvedParams = await params;
  const slug = resolvedParams.slug?.[0] ?? 'overview';

  const wiki = await getPublicWikiByShareToken(resolvedParams.shareToken, {
    requireEmbedEnabled: true,
  });

  if (!wiki) {
    notFound();
  }

  return (
    <WikiReaderShell
      wiki={wiki}
      slug={slug}
      basePath={`/embed/${resolvedParams.shareToken}`}
      showMetrics={false}
    />
  );
};

export default EmbedWikiPage;
