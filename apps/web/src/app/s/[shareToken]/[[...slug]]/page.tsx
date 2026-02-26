import Link from 'next/link';
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

interface SharedWikiPageProps {
  params: Promise<{
    shareToken: string;
    slug?: string[];
  }>;
}

const SharedWikiPage = async ({ params }: SharedWikiPageProps) => {
  const resolvedParams = await params;
  const slug = resolvedParams.slug?.[0] ?? 'overview';

  const wiki = await getPublicWikiByShareToken(resolvedParams.shareToken);
  if (!wiki) {
    notFound();
  }

  return (
    <WikiReaderShell
      wiki={wiki}
      slug={slug}
      basePath={`/s/${resolvedParams.shareToken}`}
      headerActions={
        <Link
          href="/sign-in"
          className="text-xs text-zinc-300 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 rounded-md px-2 py-1"
        >
          Sign in
        </Link>
      }
    />
  );
};

export default SharedWikiPage;
