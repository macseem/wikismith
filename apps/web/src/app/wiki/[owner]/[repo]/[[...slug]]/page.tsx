import Link from 'next/link';
import { AccountMenu } from '@/components/auth/account-menu';
import { WikiPageClient } from '@/components/wiki/wiki-page-client';
import { getSession } from '@/lib/auth/session';

interface WikiPageProps {
  params: Promise<{
    owner: string;
    repo: string;
    slug?: string[];
  }>;
}

const WikiPage = async ({ params }: WikiPageProps) => {
  const resolvedParams = await params;
  const session = await getSession();
  const slug = resolvedParams.slug?.[0] ?? 'overview';

  const headerActions = session ? (
    <AccountMenu session={session} />
  ) : (
    <Link
      href="/sign-in"
      className="text-xs text-zinc-300 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 rounded-md px-2 py-1"
    >
      Sign in
    </Link>
  );

  return (
    <WikiPageClient
      owner={resolvedParams.owner}
      repo={resolvedParams.repo}
      slug={slug}
      headerActions={headerActions}
    />
  );
};

export default WikiPage;
