import type { IIngestionResult } from '@wikismith/shared';

export const ingest = async (_repoUrl: string, _token?: string): Promise<IIngestionResult> => {
  throw new Error('Not implemented');
};
