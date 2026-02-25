import { NextResponse } from 'next/server';
import { getWiki } from '@/lib/wiki-store';

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ owner: string; repo: string }> },
) => {
  const { owner, repo } = await params;
  const wiki = getWiki(owner, repo);

  if (!wiki) {
    return NextResponse.json({ error: 'Wiki not found' }, { status: 404 });
  }

  return NextResponse.json(wiki);
};
