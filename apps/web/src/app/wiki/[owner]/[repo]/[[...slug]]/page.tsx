import { redirect } from 'next/navigation';
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

  if (!session) {
    const redirectPath =
      slug === 'overview'
        ? `/wiki/${resolvedParams.owner}/${resolvedParams.repo}`
        : `/wiki/${resolvedParams.owner}/${resolvedParams.repo}/${slug}`;
    redirect(`/sign-in?redirect=${encodeURIComponent(redirectPath)}`);
  }

  const headerActions = <AccountMenu session={session} />;

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
