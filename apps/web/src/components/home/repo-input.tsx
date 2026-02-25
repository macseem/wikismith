'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export const RepoInput = () => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      const trimmed = url.trim();
      if (!trimmed) return;

      setLoading(true);

      try {
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: trimmed }),
        });

        const data = (await response.json()) as { owner?: string; repo?: string; error?: string };

        if (!response.ok) {
          setError(data.error ?? 'Failed to process repository');
          return;
        }

        router.push(`/wiki/${data.owner}/${data.repo}`);
      } catch {
        setError('An unexpected error occurred. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [url, router],
  );

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
              Generating...
            </span>
          ) : (
            'Generate Wiki'
          )}
        </Button>
      </div>
      {error && (
        <p className="mt-3 text-sm text-red-400">{error}</p>
      )}
    </form>
  );
};
