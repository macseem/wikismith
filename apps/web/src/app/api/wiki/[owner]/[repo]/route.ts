import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getWiki } from '@/lib/wiki-store';

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ owner: string; repo: string }> },
) => {
  const { owner, repo } = await params;
  const session = await getSession().catch(() => null);
  const wiki = await getWiki(owner, repo, session?.user.workosId);

  if (!wiki) {
    return NextResponse.json({ error: 'Wiki not found' }, { status: 404 });
  }

  return NextResponse.json(wiki);
};
