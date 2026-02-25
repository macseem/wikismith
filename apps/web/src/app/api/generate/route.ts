import { NextResponse } from 'next/server';
import { parseGitHubUrl, ingest, analyze, classify } from '@wikismith/analyzer';
import { generateWiki } from '@wikismith/generator';
import { IngestionError } from '@wikismith/shared';
import { saveWiki, hasWiki, getWiki } from '@/lib/wiki-store';

export const maxDuration = 300;

export const POST = async (request: Request) => {
  try {
    const body = (await request.json()) as { url?: string; ref?: string; force?: boolean };

    if (!body.url) {
      return NextResponse.json({ error: 'Repository URL is required' }, { status: 400 });
    }

    const parsed = parseGitHubUrl(body.url);

    if (!body.force && hasWiki(parsed.owner, parsed.name)) {
      const cached = getWiki(parsed.owner, parsed.name)!;
      return NextResponse.json({
        owner: parsed.owner,
        repo: parsed.name,
        commitSha: cached.commitSha,
        cached: true,
      });
    }

    const ingestion = await ingest(body.url, { ref: body.ref });
    const analysis = analyze(ingestion);
    const featureTree = await classify(analysis, `${parsed.owner}/${parsed.name}`);

    const pages = await generateWiki({
      featureTree,
      fileContents: ingestion.files,
      repoFullName: `${parsed.owner}/${parsed.name}`,
      commitSha: ingestion.commitSha,
      readmeContent: ingestion.readme?.content,
    });

    saveWiki({
      owner: parsed.owner,
      repo: parsed.name,
      commitSha: ingestion.commitSha,
      pages,
      featureTree,
      analysis: {
        languages: analysis.languages,
        frameworks: analysis.frameworks,
        fileCount: analysis.files.length,
      },
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      owner: parsed.owner,
      repo: parsed.name,
      commitSha: ingestion.commitSha,
      cached: false,
    });
  } catch (error) {
    if (error instanceof IngestionError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode },
      );
    }
    console.error('Generation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
};
