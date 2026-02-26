'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { apiClient, ApiClientError } from '@/lib/api/client';
import type { GenerateWikiProgressEvent } from '@wikismith/contracts';

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
  const [progress, setProgress] = useState<GenerateWikiProgressEvent | null>(null);
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
      const result = await apiClient.generateWikiStream(
        { url: trimmed },
        {
          signal: abortRef.current.signal,
          onProgress: (event) => {
            setProgress(event);
          },
        },
      );

      router.push(`/wiki/${result.owner}/${result.repo}`);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;

      if (err instanceof ApiClientError) {
        if (err.payload.reauthPath) {
          setErrorActionPath(err.payload.reauthPath);
          setErrorActionLabel('Re-authenticate');
        } else if (err.payload.signInPath || err.payload.code === 'UNAUTHENTICATED') {
          setErrorActionPath(err.payload.signInPath ?? '/sign-in?redirect=%2Fdashboard');
          setErrorActionLabel('Sign in');
        }

        setError(err.payload.error);
        return;
      }

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
