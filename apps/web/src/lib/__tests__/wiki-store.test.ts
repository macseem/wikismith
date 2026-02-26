import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => {
  const tables = {
    repositories: {
      userId: 'repositories.userId',
      fullName: 'repositories.fullName',
      owner: 'repositories.owner',
      name: 'repositories.name',
      updatedAt: 'repositories.updatedAt',
    },
    wikiVersions: {
      id: 'wikiVersions.id',
      repositoryId: 'wikiVersions.repositoryId',
      commitSha: 'wikiVersions.commitSha',
      status: 'wikiVersions.status',
      generatedAt: 'wikiVersions.generatedAt',
      createdAt: 'wikiVersions.createdAt',
    },
    wikiPages: {
      wikiVersionId: 'wikiPages.wikiVersionId',
      sortOrder: 'wikiPages.sortOrder',
      createdAt: 'wikiPages.createdAt',
      id: 'wikiPages.id',
    },
  };

  return {
    tables,
    getStoredUserByWorkOSId: vi.fn(),
    db: {
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      transaction: vi.fn(),
      query: {
        repositories: {
          findFirst: vi.fn(),
          findMany: vi.fn(),
        },
        wikiVersions: {
          findFirst: vi.fn(),
        },
        wikiPages: {
          findMany: vi.fn(),
        },
      },
    },
    captured: {
      wikiVersionValues: null as Record<string, unknown> | null,
      wikiPageValues: null as Array<Record<string, unknown>> | null,
    },
  };
});

vi.mock('@/lib/auth/user-store', () => ({
  getStoredUserByWorkOSId: mockState.getStoredUserByWorkOSId,
}));

vi.mock('@wikismith/db', () => ({
  db: mockState.db,
  repositories: mockState.tables.repositories,
  wikiVersions: mockState.tables.wikiVersions,
  wikiPages: mockState.tables.wikiPages,
}));

import { deleteWiki, getWiki, saveWiki, type StoredWiki } from '../wiki-store';

const setupDbMocks = () => {
  mockState.db.insert.mockImplementation((table: unknown) => {
    if (table === mockState.tables.repositories) {
      return {
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        }),
      };
    }

    if (table === mockState.tables.wikiVersions) {
      return {
        values: vi.fn((values: Record<string, unknown>) => {
          mockState.captured.wikiVersionValues = values;
          return {
            returning: vi.fn().mockResolvedValue([{ id: 'version-1' }]),
          };
        }),
      };
    }

    if (table === mockState.tables.wikiPages) {
      return {
        values: vi.fn((values: Array<Record<string, unknown>>) => {
          mockState.captured.wikiPageValues = values;
          return Promise.resolve();
        }),
      };
    }

    throw new Error('Unexpected insert table');
  });

  mockState.db.delete.mockImplementation((table: unknown) => {
    if (table === mockState.tables.wikiPages) {
      return {
        where: vi.fn().mockResolvedValue(undefined),
      };
    }

    if (table === mockState.tables.wikiVersions) {
      return {
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'version-1' }]),
        }),
      };
    }

    throw new Error('Unexpected delete table');
  });

  mockState.db.update.mockImplementation((table: unknown) => {
    if (table === mockState.tables.wikiVersions) {
      return {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      };
    }

    throw new Error('Unexpected update table');
  });
};

describe('wiki-store DB persistence', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockState.captured.wikiVersionValues = null;
    mockState.captured.wikiPageValues = null;
    setupDbMocks();
  });

  it('persists wiki versions keyed by commit hash', async () => {
    mockState.getStoredUserByWorkOSId.mockResolvedValue({ id: 'user-1' });
    mockState.db.query.repositories.findFirst.mockResolvedValue({
      id: 'repo-1',
      defaultBranch: 'main',
      trackedBranch: 'main',
      userId: 'user-1',
    });
    mockState.db.query.wikiVersions.findFirst.mockResolvedValue(null);

    const wiki: StoredWiki = {
      generatedByWorkosId: 'user_workos_1',
      owner: 'octocat',
      repo: 'hello-world',
      branch: 'main',
      commitSha: 'abc123def456',
      featureTree: {
        repoId: 'octocat/hello-world',
        commitSha: 'abc123def456',
        generatedAt: new Date().toISOString(),
        features: [],
      },
      analysis: {
        languages: { TypeScript: 10 },
        frameworks: ['nextjs'],
        fileCount: 10,
      },
      pages: [
        {
          id: 'overview',
          featureId: 'overview',
          slug: 'overview',
          title: 'Overview',
          content: 'Overview content',
          citations: [],
          parentPageId: null,
          order: 0,
        },
        {
          id: 'feature-auth',
          featureId: 'feature-auth',
          slug: 'authentication',
          title: 'Authentication',
          content: 'Feature content',
          citations: [],
          parentPageId: 'overview',
          order: 1,
        },
      ],
      createdAt: new Date().toISOString(),
    };

    await saveWiki(wiki);

    expect(mockState.captured.wikiVersionValues?.['commitSha']).toBe('abc123def456');

    expect(mockState.captured.wikiPageValues).toBeTruthy();
    expect(mockState.captured.wikiPageValues).toHaveLength(2);
    const [overview, child] = mockState.captured.wikiPageValues!;
    expect(overview?.['wikiVersionId']).toBe('version-1');
    expect(child?.['parentPageId']).toBe(overview?.['id']);
  });

  it('loads latest ready wiki from DB', async () => {
    mockState.getStoredUserByWorkOSId.mockResolvedValue({ id: 'user-1' });
    mockState.db.query.repositories.findFirst.mockResolvedValue({
      id: 'repo-1',
      userId: 'user-1',
    });
    mockState.db.query.wikiVersions.findFirst.mockResolvedValue({
      id: 'version-1',
      commitSha: 'abc123',
      branch: 'main',
      featureTree: null,
      analysis: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    mockState.db.query.wikiPages.findMany.mockResolvedValue([
      {
        id: 'page-1',
        featureId: 'overview',
        slug: 'overview',
        title: 'Overview',
        content: 'Hello',
        citations: [],
        parentPageId: null,
        sortOrder: 0,
      },
    ]);

    const wiki = await getWiki('octocat', 'hello-world', 'user_workos_1');

    expect(wiki).toBeTruthy();
    expect(wiki?.commitSha).toBe('abc123');
    expect(wiki?.owner).toBe('octocat');
    expect(wiki?.repo).toBe('hello-world');
    expect(wiki?.pages).toHaveLength(1);
    expect(wiki?.featureTree.commitSha).toBe('abc123');
  });

  it('throws when a page parent reference is invalid', async () => {
    mockState.getStoredUserByWorkOSId.mockResolvedValue({ id: 'user-1' });
    mockState.db.query.repositories.findFirst.mockResolvedValue({
      id: 'repo-1',
      defaultBranch: 'main',
      trackedBranch: 'main',
      userId: 'user-1',
    });

    const wiki: StoredWiki = {
      generatedByWorkosId: 'user_workos_1',
      owner: 'octocat',
      repo: 'hello-world',
      branch: 'main',
      commitSha: 'abc123def456',
      featureTree: {
        repoId: 'octocat/hello-world',
        commitSha: 'abc123def456',
        generatedAt: new Date().toISOString(),
        features: [],
      },
      analysis: {
        languages: { TypeScript: 10 },
        frameworks: ['nextjs'],
        fileCount: 10,
      },
      pages: [
        {
          id: 'overview',
          featureId: 'overview',
          slug: 'overview',
          title: 'Overview',
          content: 'Overview content',
          citations: [],
          parentPageId: 'missing-parent',
          order: 0,
        },
      ],
      createdAt: new Date().toISOString(),
    };

    await expect(saveWiki(wiki)).rejects.toThrow(
      'Wiki page parent reference is invalid: missing-parent',
    );
  });

  it('returns false when deleting wiki without a matching repository record', async () => {
    mockState.getStoredUserByWorkOSId.mockResolvedValue({ id: 'user-1' });
    mockState.db.query.repositories.findFirst.mockResolvedValue(null);

    const deleted = await deleteWiki('octocat', 'hello-world', 'user_workos_1');
    expect(deleted).toBe(false);
  });
});
