import { NextResponse } from 'next/server';
import { parseGitHubUrl, ingest, analyze, classify } from '@wikismith/analyzer';
import { generateWiki } from '@wikismith/generator';
import { AppError } from '@wikismith/shared';
import { saveWiki, hasWiki, getWiki } from '@/lib/wiki-store';
import { getSession } from '@/lib/auth/session';
import { getGitHubAccessTokenByWorkOSId, syncAuthenticatedUser } from '@/lib/auth/user-store';
import { incrementDailyGenerationCount } from '@/lib/auth/rate-limit';

export const maxDuration = 300;

const MAX_BODY_SIZE = 1024;

interface GenerateBody {
  url?: string;
  ref?: string;
  force?: boolean;
}

const reAuthPath = '/sign-in?redirect=%2Fdashboard&reauth=github_scope';

const sendSSE = (controller: ReadableStreamDefaultController, event: string, data: unknown) => {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  controller.enqueue(new TextEncoder().encode(payload));
};

export const POST = async (request: Request) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      {
        error: 'Authentication required',
        code: 'UNAUTHENTICATED',
        signInPath: '/sign-in?redirect=%2Fdashboard',
      },
      { status: 401 },
    );
  }

  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
    return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
  }

  let body: GenerateBody;
  try {
    body = (await request.json()) as GenerateBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.url) {
    return NextResponse.json({ error: 'Repository URL is required' }, { status: 400 });
  }

  let parsed: ReturnType<typeof parseGitHubUrl>;
  try {
    parsed = parseGitHubUrl(body.url);
  } catch (error) {
    const message = error instanceof AppError ? error.message : 'Invalid repository URL';
    const code = error instanceof AppError ? error.code : 'INVALID_URL';
    return NextResponse.json({ error: message, code }, { status: 400 });
  }

  if (!body.force && hasWiki(parsed.owner, parsed.name)) {
    const cached = getWiki(parsed.owner, parsed.name)!;
    return NextResponse.json({
      owner: parsed.owner,
      repo: parsed.name,
      commitSha: cached.commitSha,
      cached: true,
    });
  }

  let rateLimit: Awaited<ReturnType<typeof incrementDailyGenerationCount>>;
  try {
    await syncAuthenticatedUser({
      id: session.user.workosId,
      email: session.user.email,
    });

    rateLimit = await incrementDailyGenerationCount(session.user.workosId);
  } catch (error) {
    console.error('[Generate] Failed to sync user or enforce rate limit', error);
    return NextResponse.json(
      {
        error: 'Unable to validate your account right now. Please try again.',
        code: 'ACCOUNT_VALIDATION_FAILED',
      },
      { status: 500 },
    );
  }

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: `You've reached your daily wiki generation limit (${rateLimit.used}/${rateLimit.limit}). Try again after reset.`,
        code: 'RATE_LIMITED',
        used: rateLimit.used,
        limit: rateLimit.limit,
        resetAt: rateLimit.resetAt,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.retryAfterSeconds),
        },
      },
    );
  }

  const githubAccessToken = await getGitHubAccessTokenByWorkOSId(session.user.workosId);

  const accept = request.headers.get('accept') ?? '';
  const wantsSSE = accept.split(',').some((t) => t.trim().startsWith('text/event-stream'));

  if (!wantsSSE) {
    return runSynchronous(parsed, body, githubAccessToken);
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        sendSSE(controller, 'progress', {
          stage: 'ingesting',
          message: `Fetching ${parsed.owner}/${parsed.name}...`,
        });

        const ingestion = await ingest(body.url!, {
          ref: body.ref,
          token: githubAccessToken ?? undefined,
        });

        sendSSE(controller, 'progress', {
          stage: 'analyzing',
          message: `Analyzing ${ingestion.metadata.totalFiles} files...`,
        });

        const analysis = analyze(ingestion);

        sendSSE(controller, 'progress', {
          stage: 'classifying',
          message: `Classifying features across ${analysis.files.length} files...`,
        });

        const featureTree = await classify(analysis, `${parsed.owner}/${parsed.name}`, {
          commitSha: ingestion.commitSha,
        });

        const totalPages =
          1 + featureTree.features.reduce((sum, f) => sum + 1 + f.children.length, 0);

        sendSSE(controller, 'progress', {
          stage: 'generating',
          message: `Generating ${totalPages} wiki pages...`,
          total: totalPages,
          completed: 0,
        });

        const pages = await generateWiki(
          {
            featureTree,
            fileContents: ingestion.files,
            repoFullName: `${parsed.owner}/${parsed.name}`,
            commitSha: ingestion.commitSha,
            readmeContent: ingestion.readme?.content,
          },
          {
            onProgress: (completed, total) => {
              sendSSE(controller, 'progress', {
                stage: 'generating',
                message: `Generating wiki pages (${completed}/${total})...`,
                total,
                completed,
              });
            },
          },
        );

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

        sendSSE(controller, 'complete', {
          owner: parsed.owner,
          repo: parsed.name,
          commitSha: ingestion.commitSha,
          cached: false,
        });
      } catch (error) {
        if (error instanceof AppError) {
          if (error.code === 'ACCESS_DENIED') {
            sendSSE(controller, 'error', {
              error:
                'GitHub access was denied for this repository. Re-authenticate and approve repository scopes.',
              code: 'MISSING_GITHUB_SCOPE',
              statusCode: 403,
              reauthPath: reAuthPath,
            });
            return;
          }

          sendSSE(controller, 'error', {
            error: error.message,
            code: error.code,
            statusCode: error.statusCode,
          });
        } else {
          console.error('Generation error:', error);
          sendSSE(controller, 'error', {
            error: 'Internal server error',
            code: 'INTERNAL_ERROR',
            statusCode: 500,
          });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
};

const runSynchronous = async (
  parsed: ReturnType<typeof parseGitHubUrl>,
  body: GenerateBody,
  githubAccessToken: string | null,
) => {
  try {
    const ingestion = await ingest(body.url!, {
      ref: body.ref,
      token: githubAccessToken ?? undefined,
    });
    const analysis = analyze(ingestion);
    const featureTree = await classify(analysis, `${parsed.owner}/${parsed.name}`, {
      commitSha: ingestion.commitSha,
    });

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
    if (error instanceof AppError) {
      if (error.code === 'ACCESS_DENIED') {
        return NextResponse.json(
          {
            error:
              'GitHub access was denied for this repository. Re-authenticate and approve repository scopes.',
            code: 'MISSING_GITHUB_SCOPE',
            reauthPath: reAuthPath,
          },
          { status: 403 },
        );
      }

      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode },
      );
    }
    console.error('Generation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
};
