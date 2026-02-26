'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { WikiStatus } from '@/lib/repos/repository-service';
import { apiClient, ApiClientError } from '@/lib/api/client';

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
  const [isSharingLoading, setIsSharingLoading] = useState(false);
  const [isSharingSaving, setIsSharingSaving] = useState(false);
  const [isRotatingShare, setIsRotatingShare] = useState(false);
  const [settingsBranch, setSettingsBranch] = useState(trackedBranch ?? defaultBranch);
  const [settingsAutoUpdate, setSettingsAutoUpdate] = useState(autoUpdate);
  const [sharingLoaded, setSharingLoaded] = useState(false);
  const [sharingPublic, setSharingPublic] = useState(false);
  const [sharingEmbedEnabled, setSharingEmbedEnabled] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [branches, setBranches] = useState<string[]>([]);
  const [branchesLoaded, setBranchesLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionPath, setActionPath] = useState<string | null>(null);
  const [actionLabel, setActionLabel] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const buildPublicLink = (token: string): string => {
    if (typeof window === 'undefined') {
      return `/s/${token}`;
    }

    return `${window.location.origin}/s/${token}`;
  };

  const buildEmbedLink = (token: string): string => {
    if (typeof window === 'undefined') {
      return `/embed/${token}`;
    }

    return `${window.location.origin}/embed/${token}`;
  };

  const buildIframeSnippet = (token: string): string =>
    `<iframe src="${buildEmbedLink(token)}" width="100%" height="720" style="border:0;" loading="lazy"></iframe>`;

  const copyToClipboard = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(successMessage);
      setError(null);
    } catch {
      setError('Unable to copy to clipboard.');
    }
  };

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
      if (data.branches.length > 0) {
        setSettingsBranch((currentBranch) => {
          if (data.branches.includes(currentBranch)) {
            return currentBranch;
          }

          if (data.branches.includes(defaultBranch)) {
            return defaultBranch;
          }

          return data.branches[0] ?? currentBranch;
        });
      }

      setBranchesLoaded(true);
      setError(null);
    } catch {
      setError('Failed to load branches');
    }
  };

  const loadSharingSettings = async () => {
    if (sharingLoaded || status !== 'ready') {
      return;
    }

    setIsSharingLoading(true);
    setError(null);

    try {
      const settings = await apiClient.getRepoSharingSettings(owner, repo);
      setSharingPublic(settings.isPublic);
      setSharingEmbedEnabled(settings.embedEnabled);
      setShareToken(settings.shareToken);
      setSharingLoaded(true);
    } catch (error) {
      if (error instanceof ApiClientError) {
        handleRouteError(error.payload, 'Failed to load sharing settings');
      } else {
        setError('Failed to load sharing settings');
      }
    } finally {
      setIsSharingLoading(false);
    }
  };

  const saveSharingSettings = async () => {
    setIsSharingSaving(true);
    setError(null);
    setNotice(null);

    try {
      const settings = await apiClient.updateRepoSharingSettings(owner, repo, {
        isPublic: sharingPublic,
        embedEnabled: sharingEmbedEnabled,
      });
      setSharingPublic(settings.isPublic);
      setSharingEmbedEnabled(settings.embedEnabled);
      setShareToken(settings.shareToken);
      setNotice('Sharing settings saved');
      setSharingLoaded(true);
    } catch (error) {
      if (error instanceof ApiClientError) {
        handleRouteError(error.payload, 'Failed to save sharing settings');
      } else {
        setError('Failed to save sharing settings');
      }
    } finally {
      setIsSharingSaving(false);
    }
  };

  const rotateSharingLink = async () => {
    const confirmed = globalThis.confirm(
      'Rotate shared link? Existing shared and embedded links will stop working immediately.',
    );
    if (!confirmed) {
      return;
    }

    setIsRotatingShare(true);
    setError(null);
    setNotice(null);

    try {
      const settings = await apiClient.rotateRepoSharingToken(owner, repo);
      setSharingPublic(settings.isPublic);
      setSharingEmbedEnabled(settings.embedEnabled);
      setShareToken(settings.shareToken);
      setNotice('Sharing link rotated');
      setSharingLoaded(true);
    } catch (error) {
      if (error instanceof ApiClientError) {
        handleRouteError(error.payload, 'Failed to rotate sharing link');
      } else {
        setError('Failed to rotate sharing link');
      }
    } finally {
      setIsRotatingShare(false);
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
      const data = await apiClient.generateWiki({
        url: repoUrl,
        force: status === 'ready',
      });

      setStatus('ready');
      router.push(`/wiki/${data.owner}/${data.repo}`);
    } catch (error) {
      if (error instanceof ApiClientError) {
        handleRouteError(error.payload, 'Generation failed');
        setStatus('failed');
        return;
      }

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

      {status === 'ready' && (
        <details
          className="rounded-md border border-zinc-800 p-3"
          onToggle={(event) => {
            const details = event.currentTarget as HTMLDetailsElement;
            if (details.open) {
              void loadSharingSettings();
            }
          }}
        >
          <summary className="cursor-pointer text-sm text-zinc-300">Sharing</summary>

          <div className="mt-3 space-y-3">
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={sharingPublic}
                onChange={(event) => setSharingPublic(event.target.checked)}
                disabled={isSharingLoading}
                className="h-4 w-4 rounded border-zinc-700 bg-zinc-900"
              />
              Public wiki (shareable link)
            </label>

            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={sharingEmbedEnabled}
                onChange={(event) => setSharingEmbedEnabled(event.target.checked)}
                disabled={isSharingLoading}
                className="h-4 w-4 rounded border-zinc-700 bg-zinc-900"
              />
              Allow embeds
            </label>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={saveSharingSettings}
                disabled={isSharingSaving || isSharingLoading}
              >
                {isSharingSaving ? 'Saving...' : 'Save sharing'}
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={rotateSharingLink}
                disabled={isRotatingShare || isSharingLoading}
              >
                {isRotatingShare ? 'Rotating...' : 'Rotate link'}
              </Button>
            </div>

            {isSharingLoading && (
              <p className="text-xs text-zinc-500">Loading sharing settings...</p>
            )}

            {sharingLoaded && shareToken && (
              <div className="space-y-2">
                <label htmlFor={`${fullName}-public-link`} className="text-xs text-zinc-400">
                  Public link
                </label>
                <div className="flex gap-2">
                  <Input
                    id={`${fullName}-public-link`}
                    readOnly
                    value={buildPublicLink(shareToken)}
                    className="h-9 bg-zinc-900 border-zinc-700"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      copyToClipboard(buildPublicLink(shareToken), 'Public link copied')
                    }
                    disabled={!sharingPublic}
                  >
                    Copy
                  </Button>
                </div>

                <label htmlFor={`${fullName}-embed-link`} className="text-xs text-zinc-400">
                  Embed URL
                </label>
                <div className="flex gap-2">
                  <Input
                    id={`${fullName}-embed-link`}
                    readOnly
                    value={buildEmbedLink(shareToken)}
                    className="h-9 bg-zinc-900 border-zinc-700"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(buildEmbedLink(shareToken), 'Embed URL copied')}
                    disabled={!sharingPublic || !sharingEmbedEnabled}
                  >
                    Copy
                  </Button>
                </div>

                <label htmlFor={`${fullName}-embed-snippet`} className="text-xs text-zinc-400">
                  Iframe snippet
                </label>
                <div className="flex gap-2">
                  <Input
                    id={`${fullName}-embed-snippet`}
                    readOnly
                    value={buildIframeSnippet(shareToken)}
                    className="h-9 bg-zinc-900 border-zinc-700"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      copyToClipboard(buildIframeSnippet(shareToken), 'Embed snippet copied')
                    }
                    disabled={!sharingPublic || !sharingEmbedEnabled}
                  >
                    Copy
                  </Button>
                </div>
              </div>
            )}
          </div>
        </details>
      )}

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
