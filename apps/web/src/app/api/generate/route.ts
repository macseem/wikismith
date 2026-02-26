import { NextResponse } from 'next/server';
import { parseGitHubUrl, ingest, analyze, classify } from '@wikismith/analyzer';
import { apiContracts, type GenerateWikiRequest } from '@wikismith/contracts';
import { generateWiki } from '@wikismith/generator';
import { AppError, type IClassifiedFeatureTree, type IWikiPage } from '@wikismith/shared';
import { getWiki, saveWiki } from '@/lib/wiki-store';
import { getSession } from '@/lib/auth/session';
import { getGitHubAccessTokenByWorkOSId, syncAuthenticatedUser } from '@/lib/auth/user-store';
import { incrementDailyGenerationCount } from '@/lib/auth/rate-limit';

export const maxDuration = 300;

const MAX_BODY_SIZE = 1024;
const isPlaywrightE2E =
  process.env['PLAYWRIGHT_E2E'] === '1' &&
  process.env['E2E_BYPASS_AUTH'] === '1' &&
  process.env['NODE_ENV'] !== 'production';

interface SchemaParser<T> {
  parse: (value: unknown) => T;
}

const jsonResponse = <T>(schema: SchemaParser<T>, payload: unknown, init?: ResponseInit) =>
  NextResponse.json(schema.parse(payload), init);

const reAuthPath = '/sign-in?redirect=%2Fdashboard&reauth=github_scope';

const sendSSE = <T>(
  controller: ReadableStreamDefaultController,
  event: string,
  data: unknown,
  schema: SchemaParser<T>,
) => {
  const payload = `event: ${event}\ndata: ${JSON.stringify(schema.parse(data))}\n\n`;
  controller.enqueue(new TextEncoder().encode(payload));
};

const slugify = (value: string): string => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'feature';
};

const buildDeterministicWikiPages = async (
  featureTree: IClassifiedFeatureTree,
  repoFullName: string,
  commitSha: string,
  onProgress?: (completed: number, total: number) => void,
): Promise<IWikiPage[]> => {
  const pages: IWikiPage[] = [];
  const total =
    1 + featureTree.features.reduce((sum, feature) => sum + 1 + feature.children.length, 0);
  let completed = 0;
  const overviewPageId = crypto.randomUUID();

  const reportProgress = () => {
    completed += 1;
    onProgress?.(completed, total);
  };

  pages.push({
    id: overviewPageId,
    featureId: 'overview',
    slug: 'overview',
    title: 'Overview',
    content: [
      `## ${repoFullName}`,
      '',
      `Generated for commit \`${commitSha}\` with ${featureTree.features.length} top-level features.`,
      '',
      '## Highlights',
      '- Feature-oriented navigation generated from repository analysis.',
      '- Pages include deterministic content for local E2E runs.',
    ].join('\n'),
    citations: [],
    parentPageId: null,
    order: 0,
  });
  reportProgress();

  let order = 1;
  featureTree.features.forEach((feature, featureIndex) => {
    const featurePageId = crypto.randomUUID();
    const featureSlugBase = slugify(feature.name);
    const featureSlug = `${featureSlugBase}-${featureIndex + 1}`;
    const relevantFiles = feature.relevantFiles.slice(0, 5);

    pages.push({
      id: featurePageId,
      featureId: feature.id,
      slug: featureSlug,
      title: feature.name,
      content: [
        `## ${feature.name}`,
        '',
        feature.description || 'This feature groups related repository behavior.',
        '',
        '## Relevant files',
        ...(relevantFiles.length > 0
          ? relevantFiles.map((file) => `- \`${file.path}\` (${file.role})`)
          : ['- No relevant files were detected for this feature.']),
      ].join('\n'),
      citations: [],
      parentPageId: overviewPageId,
      order,
    });
    order += 1;
    reportProgress();

    feature.children.forEach((child, childIndex) => {
      const childSlugBase = slugify(child.name);
      const childSlug = `${featureSlug}-${childSlugBase}-${childIndex + 1}`;

      pages.push({
        id: crypto.randomUUID(),
        featureId: child.id,
        slug: childSlug,
        title: child.name,
        content: [
          `## ${child.name}`,
          '',
          child.description || 'Sub-feature details extracted from repository structure.',
          '',
          '## Parent feature',
          `- ${feature.name}`,
        ].join('\n'),
        citations: [],
        parentPageId: featurePageId,
        order,
      });
      order += 1;
      reportProgress();
    });
  });

  return pages;
};

const generatePages = async (
  featureTree: IClassifiedFeatureTree,
  ingestion: Awaited<ReturnType<typeof ingest>>,
  repoFullName: string,
  onProgress?: (completed: number, total: number) => void,
): Promise<IWikiPage[]> => {
  if (isPlaywrightE2E) {
    return buildDeterministicWikiPages(featureTree, repoFullName, ingestion.commitSha, onProgress);
  }

  return generateWiki(
    {
      featureTree,
      fileContents: ingestion.files,
      repoFullName,
      commitSha: ingestion.commitSha,
      readmeContent: ingestion.readme?.content,
    },
    onProgress ? { onProgress } : undefined,
  );
};

export const POST = async (request: Request) => {
  const session = await getSession();
  if (!session) {
    return jsonResponse(
      apiContracts.generate.post.error,
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
    return jsonResponse(
      apiContracts.generate.post.error,
      { error: 'Request body too large', code: 'REQUEST_TOO_LARGE' },
      { status: 413 },
    );
  }

  let rawBody: unknown;
  try {
    rawBody = (await request.json()) as unknown;
  } catch {
    return jsonResponse(
      apiContracts.generate.post.error,
      { error: 'Invalid JSON body', code: 'INVALID_BODY' },
      { status: 400 },
    );
  }

  const bodyResult = apiContracts.generate.post.body.safeParse(rawBody);
  if (!bodyResult.success) {
    return jsonResponse(
      apiContracts.generate.post.error,
      { error: 'Repository URL is required', code: 'INVALID_BODY' },
      { status: 400 },
    );
  }

  const body: GenerateWikiRequest = bodyResult.data;

  let parsed: ReturnType<typeof parseGitHubUrl>;
  try {
    parsed = parseGitHubUrl(body.url);
  } catch (error) {
    const message = error instanceof AppError ? error.message : 'Invalid repository URL';
    const code = error instanceof AppError ? error.code : 'INVALID_URL';
    return jsonResponse(
      apiContracts.generate.post.error,
      { error: message, code },
      { status: 400 },
    );
  }

  if (!body.force) {
    const cached = await getWiki(parsed.owner, parsed.name, session.user.workosId);
    if (cached) {
      return jsonResponse(apiContracts.generate.post.response, {
        owner: parsed.owner,
        repo: parsed.name,
        commitSha: cached.commitSha,
        cached: true,
      });
    }
  }

  let rateLimit: Awaited<ReturnType<typeof incrementDailyGenerationCount>>;
  try {
    await syncAuthenticatedUser({
      id: session.user.workosId,
      email: session.user.email,
    });

    if (isPlaywrightE2E) {
      rateLimit = {
        allowed: true,
        used: 0,
        limit: Number.MAX_SAFE_INTEGER,
        retryAfterSeconds: 0,
        resetAt: new Date().toISOString(),
      };
    } else {
      rateLimit = await incrementDailyGenerationCount(session.user.workosId);
    }
  } catch (error) {
    console.error('[Generate] Failed to sync user or enforce rate limit', error);
    return jsonResponse(
      apiContracts.generate.post.error,
      {
        error: 'Unable to validate your account right now. Please try again.',
        code: 'ACCOUNT_VALIDATION_FAILED',
      },
      { status: 500 },
    );
  }

  if (!rateLimit.allowed) {
    return jsonResponse(
      apiContracts.generate.post.error,
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

  let githubAccessToken: string | null;
  try {
    githubAccessToken = await getGitHubAccessTokenByWorkOSId(session.user.workosId);
  } catch (error) {
    console.error('[Generate] Failed to load GitHub access token', error);
    return jsonResponse(
      apiContracts.generate.post.error,
      {
        error: 'Unable to load your GitHub authorization right now. Please try again.',
        code: 'GITHUB_TOKEN_LOOKUP_FAILED',
      },
      { status: 500 },
    );
  }

  const accept = request.headers.get('accept') ?? '';
  const wantsSSE = accept.split(',').some((t) => t.trim().startsWith('text/event-stream'));

  if (!wantsSSE) {
    return runSynchronous(parsed, body, githubAccessToken, session.user.workosId);
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        sendSSE(
          controller,
          'progress',
          {
            stage: 'ingesting',
            message: `Fetching ${parsed.owner}/${parsed.name}...`,
          },
          apiContracts.generate.post.sse.progress,
        );

        const ingestion = await ingest(body.url, {
          ref: body.ref,
          token: githubAccessToken ?? undefined,
        });

        sendSSE(
          controller,
          'progress',
          {
            stage: 'analyzing',
            message: `Analyzing ${ingestion.metadata.totalFiles} files...`,
          },
          apiContracts.generate.post.sse.progress,
        );

        const analysis = analyze(ingestion);

        sendSSE(
          controller,
          'progress',
          {
            stage: 'classifying',
            message: `Classifying features across ${analysis.files.length} files...`,
          },
          apiContracts.generate.post.sse.progress,
        );

        const featureTree = await classify(analysis, `${parsed.owner}/${parsed.name}`, {
          commitSha: ingestion.commitSha,
        });

        const totalPages =
          1 + featureTree.features.reduce((sum, f) => sum + 1 + f.children.length, 0);

        sendSSE(
          controller,
          'progress',
          {
            stage: 'generating',
            message: `Generating ${totalPages} wiki pages...`,
            total: totalPages,
            completed: 0,
          },
          apiContracts.generate.post.sse.progress,
        );

        const pages = await generatePages(
          featureTree,
          ingestion,
          `${parsed.owner}/${parsed.name}`,
          (completed, total) => {
            sendSSE(
              controller,
              'progress',
              {
                stage: 'generating',
                message: `Generating wiki pages (${completed}/${total})...`,
                total,
                completed,
              },
              apiContracts.generate.post.sse.progress,
            );
          },
        );

        await saveWiki({
          generatedByWorkosId: session.user.workosId,
          owner: parsed.owner,
          repo: parsed.name,
          branch: ingestion.ref,
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

        sendSSE(
          controller,
          'complete',
          {
            owner: parsed.owner,
            repo: parsed.name,
            commitSha: ingestion.commitSha,
            cached: false,
          },
          apiContracts.generate.post.sse.complete,
        );
      } catch (error) {
        if (error instanceof AppError) {
          if (error.code === 'ACCESS_DENIED') {
            sendSSE(
              controller,
              'error',
              {
                error:
                  'GitHub access was denied for this repository. Re-authenticate and approve repository scopes.',
                code: 'MISSING_GITHUB_SCOPE',
                statusCode: 403,
                reauthPath: reAuthPath,
              },
              apiContracts.generate.post.sse.error,
            );
            return;
          }

          sendSSE(
            controller,
            'error',
            {
              error: error.message,
              code: error.code,
              statusCode: error.statusCode,
            },
            apiContracts.generate.post.sse.error,
          );
        } else {
          console.error('Generation error:', error);
          sendSSE(
            controller,
            'error',
            {
              error: 'Internal server error',
              code: 'INTERNAL_ERROR',
              statusCode: 500,
            },
            apiContracts.generate.post.sse.error,
          );
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
  body: GenerateWikiRequest,
  githubAccessToken: string | null,
  workosUserId: string,
) => {
  try {
    const ingestion = await ingest(body.url, {
      ref: body.ref,
      token: githubAccessToken ?? undefined,
    });
    const analysis = analyze(ingestion);
    const featureTree = await classify(analysis, `${parsed.owner}/${parsed.name}`, {
      commitSha: ingestion.commitSha,
    });

    const pages = await generatePages(featureTree, ingestion, `${parsed.owner}/${parsed.name}`);

    await saveWiki({
      generatedByWorkosId: workosUserId,
      owner: parsed.owner,
      repo: parsed.name,
      branch: ingestion.ref,
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

    return jsonResponse(apiContracts.generate.post.response, {
      owner: parsed.owner,
      repo: parsed.name,
      commitSha: ingestion.commitSha,
      cached: false,
    });
  } catch (error) {
    if (error instanceof AppError) {
      if (error.code === 'ACCESS_DENIED') {
        return jsonResponse(
          apiContracts.generate.post.error,
          {
            error:
              'GitHub access was denied for this repository. Re-authenticate and approve repository scopes.',
            code: 'MISSING_GITHUB_SCOPE',
            reauthPath: reAuthPath,
          },
          { status: 403 },
        );
      }

      return jsonResponse(
        apiContracts.generate.post.error,
        { error: error.message, code: error.code },
        { status: error.statusCode },
      );
    }
    console.error('Generation error:', error);
    return jsonResponse(
      apiContracts.generate.post.error,
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
};
