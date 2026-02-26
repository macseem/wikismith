'use client';

import { useAtom } from 'jotai';
import { atom } from 'jotai';
import { useCallback } from 'react';

interface RepoSidebarState {
  collapsedGroupIds: Record<string, true>;
  scrollTop: number;
}

const DEFAULT_REPO_STATE: RepoSidebarState = {
  collapsedGroupIds: {},
  scrollTop: 0,
};

const sidebarStateAtom = atom<Record<string, RepoSidebarState>>({});

export const useWikiSidebarState = (repoKey: string) => {
  const [allState, setAllState] = useAtom(sidebarStateAtom);
  const repoState = allState[repoKey] ?? DEFAULT_REPO_STATE;

  const setGroupCollapsed = useCallback(
    (groupId: string, collapsed: boolean) => {
      setAllState((prev) => {
        const current = prev[repoKey] ?? DEFAULT_REPO_STATE;
        const isCollapsed = Boolean(current.collapsedGroupIds[groupId]);

        if (isCollapsed === collapsed) {
          return prev;
        }

        const nextCollapsedGroupIds = { ...current.collapsedGroupIds };
        if (collapsed) {
          nextCollapsedGroupIds[groupId] = true;
        } else {
          delete nextCollapsedGroupIds[groupId];
        }

        return {
          ...prev,
          [repoKey]: {
            ...current,
            collapsedGroupIds: nextCollapsedGroupIds,
          },
        };
      });
    },
    [repoKey, setAllState],
  );

  const ensureGroupExpanded = useCallback(
    (groupId: string) => {
      setGroupCollapsed(groupId, false);
    },
    [setGroupCollapsed],
  );

  const isGroupCollapsed = useCallback(
    (groupId: string): boolean => Boolean(repoState.collapsedGroupIds[groupId]),
    [repoState.collapsedGroupIds],
  );

  const setScrollTop = useCallback(
    (scrollTop: number) => {
      setAllState((prev) => {
        const current = prev[repoKey] ?? DEFAULT_REPO_STATE;
        if (Math.abs(current.scrollTop - scrollTop) < 1) {
          return prev;
        }

        return {
          ...prev,
          [repoKey]: {
            ...current,
            scrollTop,
          },
        };
      });
    },
    [repoKey, setAllState],
  );

  return {
    scrollTop: repoState.scrollTop,
    isGroupCollapsed,
    setGroupCollapsed,
    ensureGroupExpanded,
    setScrollTop,
  };
};
