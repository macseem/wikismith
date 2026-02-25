'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { WikiStatus } from '@/lib/repos/repository-service';

interface RepositoryCardActionsProps {
  owner: string;
  repo: string;
  fullName: string;
  defaultBranch: string;
  trackedBranch: string | null;
  autoUpdate: boolean;
  initialStatus: WikiStatus;
}

interface RouteErrorPayload {
  error?: string;
  reauthPath?: string;
  signInPath?: string;
}

export const RepositoryCardActions = ({
  owner,
  repo,
  fullName,
  defaultBranch,
  trackedBranch,
  autoUpdate,
  initialStatus,
}: RepositoryCardActionsProps) => {
  const router = useRouter();
  const [status, setStatus] = useState<WikiStatus>(initialStatus);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [settingsBranch, setSettingsBranch] = useState(trackedBranch ?? defaultBranch);
  const [settingsAutoUpdate, setSettingsAutoUpdate] = useState(autoUpdate);
  const [branches, setBranches] = useState<string[]>([]);
  const [branchesLoaded, setBranchesLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionPath, setActionPath] = useState<string | null>(null);
  const [actionLabel, setActionLabel] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const repoUrl = `https://github.com/${fullName}`;

  const handleRouteError = (payload: RouteErrorPayload, fallbackMessage: string) => {
    setError(payload.error ?? fallbackMessage);

    if (payload.reauthPath) {
      setActionPath(payload.reauthPath);
      setActionLabel('Re-authenticate');
      return;
    }

    if (payload.signInPath) {
      setActionPath(payload.signInPath);
      setActionLabel('Sign in');
      return;
    }

    setActionPath(null);
    setActionLabel(null);
  };

  const loadBranches = async () => {
    if (branchesLoaded) {
      return;
    }

    try {
      const response = await fetch(`/api/repos/${owner}/${repo}/branches`, {
        method: 'GET',
      });

      if (!response.ok) {
        const data = (await response.json()) as RouteErrorPayload;
        handleRouteError(data, 'Failed to load branches');
        return;
      }

      const data = (await response.json()) as { branches: string[] };
      setBranches(data.branches);
      setBranchesLoaded(true);
      setError(null);
    } catch {
      setError('Failed to load branches');
    }
  };

  const saveSettings = async () => {
    setIsSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/repos/${owner}/${repo}/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          trackedBranch: settingsBranch,
          autoUpdate: settingsAutoUpdate,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as RouteErrorPayload;
        handleRouteError(data, 'Failed to save repository settings');
        return;
      }

      setNotice('Settings saved');
      router.refresh();
    } catch {
      setError('Failed to save repository settings');
    } finally {
      setIsSaving(false);
    }
  };

  const generateWiki = async () => {
    setIsGenerating(true);
    setError(null);
    setNotice(null);
    setActionPath(null);
    setActionLabel(null);
    setStatus('generating');

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          url: repoUrl,
          force: status === 'ready',
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as RouteErrorPayload;
        handleRouteError(data, 'Generation failed');
        setStatus('failed');
        return;
      }

      const data = (await response.json()) as { owner?: string; repo?: string };
      if (!data.owner || !data.repo) {
        setStatus('failed');
        setError('Generation response was incomplete. Please try again.');
        return;
      }

      setStatus('ready');
      router.push(`/wiki/${data.owner}/${data.repo}`);
    } catch {
      setStatus('failed');
      setError('Generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const deleteGeneratedWiki = async () => {
    const confirmed = globalThis.confirm(
      `Delete generated wiki for ${fullName}? This cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/repos/${owner}/${repo}/wiki`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = (await response.json()) as RouteErrorPayload;
        handleRouteError(data, 'Failed to delete wiki');
        return;
      }

      setStatus('not_generated');
      setNotice('Wiki deleted');
      router.refresh();
    } catch {
      setError('Failed to delete wiki');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {status === 'ready' && (
          <Button asChild size="sm" variant="secondary">
            <Link href={`/wiki/${owner}/${repo}`}>View Wiki</Link>
          </Button>
        )}

        <Button size="sm" onClick={generateWiki} disabled={isGenerating || status === 'generating'}>
          {status === 'generating' || isGenerating
            ? 'Generating...'
            : status === 'ready'
              ? 'Regenerate'
              : 'Generate Wiki'}
        </Button>

        {(status === 'ready' || status === 'failed') && (
          <Button size="sm" variant="outline" onClick={deleteGeneratedWiki} disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Delete Wiki'}
          </Button>
        )}
      </div>

      <details
        className="rounded-md border border-zinc-800 p-3"
        onToggle={(event) => {
          const details = event.currentTarget as HTMLDetailsElement;
          if (details.open) {
            void loadBranches();
          }
        }}
      >
        <summary className="cursor-pointer text-sm text-zinc-300">Repository settings</summary>

        <div className="mt-3 space-y-3">
          <div className="space-y-1">
            <label htmlFor={`${fullName}-tracked-branch`} className="text-xs text-zinc-400">
              Tracked branch
            </label>

            {branches.length > 0 ? (
              <select
                id={`${fullName}-tracked-branch`}
                value={settingsBranch}
                onChange={(event) => setSettingsBranch(event.target.value)}
                className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 text-sm"
              >
                {branches.map((branch) => (
                  <option key={branch} value={branch}>
                    {branch}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                id={`${fullName}-tracked-branch`}
                value={settingsBranch}
                onChange={(event) => setSettingsBranch(event.target.value)}
                placeholder={defaultBranch}
                className="h-9 bg-zinc-900 border-zinc-700"
              />
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={settingsAutoUpdate}
              onChange={(event) => setSettingsAutoUpdate(event.target.checked)}
              className="h-4 w-4 rounded border-zinc-700 bg-zinc-900"
            />
            Auto-update wiki on new commits
          </label>

          <Button size="sm" variant="outline" onClick={saveSettings} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save settings'}
          </Button>
        </div>
      </details>

      {notice && <p className="text-xs text-emerald-400">{notice}</p>}

      {error && (
        <div className="space-y-1">
          <p className="text-xs text-red-400">{error}</p>
          {actionPath && actionLabel && (
            <button
              type="button"
              onClick={() => router.push(actionPath)}
              className="text-xs text-amber-300 hover:underline"
            >
              {actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
