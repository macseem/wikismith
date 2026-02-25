'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface ProgressState {
  stage: string;
  message: string;
  total?: number;
  completed?: number;
}

const STAGE_LABELS: Record<string, string> = {
  ingesting: 'Fetching repository',
  analyzing: 'Analyzing codebase',
  classifying: 'Classifying features',
  generating: 'Generating wiki pages',
};

export const RepoInput = () => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorActionPath, setErrorActionPath] = useState<string | null>(null);
  const [errorActionLabel, setErrorActionLabel] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const router = useRouter();
  const abortRef = useRef<AbortController | null>(null);

  const runGeneration = useCallback(async () => {
    setError(null);
    setErrorActionPath(null);
    setErrorActionLabel(null);
    setProgress(null);

    const trimmed = url.trim();
    if (!trimmed) return;

    setLoading(true);
    abortRef.current = new AbortController();

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({ url: trimmed }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        const data = (await response.json()) as {
          error?: string;
          signInPath?: string;
          reauthPath?: string;
          code?: string;
        };

        if (data.reauthPath) {
          setErrorActionPath(data.reauthPath);
          setErrorActionLabel('Re-authenticate');
        } else if (data.signInPath || data.code === 'UNAUTHENTICATED') {
          setErrorActionPath(data.signInPath ?? '/sign-in?redirect=%2Fdashboard');
          setErrorActionLabel('Sign in');
        }

        setError(data.error ?? 'Failed to process repository');
        return;
      }

      const contentType = response.headers.get('content-type') ?? '';

      if (contentType.includes('application/json')) {
        const data = (await response.json()) as {
          owner?: string;
          repo?: string;
          error?: string;
        };
        if (!data.owner || !data.repo) {
          setError(data.error ?? 'Invalid response from server');
          return;
        }
        router.push(`/wiki/${data.owner}/${data.repo}`);
        return;
      }

      if (!response.body) {
        setError('Streaming not supported by the browser');
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentEvent = '';
      let streamCompleted = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7);
          } else if (line.startsWith('data: ')) {
            let data: Record<string, unknown>;
            try {
              data = JSON.parse(line.slice(6)) as Record<string, unknown>;
            } catch {
              console.warn('[RepoInput] Ignoring malformed SSE payload');
              continue;
            }

            if (currentEvent === 'progress') {
              setProgress(data as unknown as ProgressState);
            } else if (currentEvent === 'complete') {
              const { owner, repo } = data as { owner: string; repo: string };
              streamCompleted = true;
              router.push(`/wiki/${owner}/${repo}`);
              return;
            } else if (currentEvent === 'error') {
              streamCompleted = true;
              setError((data.error as string) ?? 'Generation failed');
              const reauthPath = data.reauthPath as string | undefined;
              if (reauthPath) {
                setErrorActionPath(reauthPath);
                setErrorActionLabel('Re-authenticate');
              }
              return;
            }
          }
        }
      }

      if (!streamCompleted) {
        setError('Connection lost. Please try again.');
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error('[RepoInput] Submission failed:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
      setProgress(null);
      abortRef.current = null;
    }
  }, [url, router]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      runGeneration();
    },
    [runGeneration],
  );

  const progressLabel = progress ? (STAGE_LABELS[progress.stage] ?? progress.stage) : null;
  const progressDetail =
    progress?.total && progress.completed !== undefined
      ? `${progress.completed}/${progress.total}`
      : null;

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="flex gap-3">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://github.com/owner/repo or owner/repo"
          className="h-12 text-base bg-zinc-900 border-zinc-700 placeholder:text-zinc-500"
          disabled={loading}
        />
        <Button
          type="submit"
          size="lg"
          className="h-12 px-8 font-medium"
          disabled={loading || !url.trim()}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              {progressLabel ?? 'Starting...'}
            </span>
          ) : (
            'Generate Wiki'
          )}
        </Button>
      </div>

      {loading && progress && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-sm text-zinc-400">
            <span>{progress.message}</span>
            {progressDetail && (
              <span className="text-zinc-500 font-mono text-xs">{progressDetail}</span>
            )}
          </div>
          {progress.total && progress.completed !== undefined && (
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${Math.round((progress.completed / progress.total) * 100)}%` }}
              />
            </div>
          )}
          <p className="text-xs text-zinc-500">
            This typically takes 2–5 minutes depending on repository size.
          </p>
        </div>
      )}

      {error && (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-red-400">{error}</p>
          {errorActionPath && errorActionLabel && (
            <button
              type="button"
              onClick={() => router.push(errorActionPath)}
              className="text-xs text-amber-300 hover:underline"
            >
              {errorActionLabel}
            </button>
          )}
          {!loading && (
            <button
              type="button"
              onClick={runGeneration}
              className="text-xs text-blue-400 hover:underline"
            >
              Try again
            </button>
          )}
        </div>
      )}
    </form>
  );
};
