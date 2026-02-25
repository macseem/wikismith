import type { IAnalysisResult, IClassifiedFeatureTree } from '@wikismith/shared';

export const classify = async (
  _analysis: IAnalysisResult,
  _repoId?: string,
): Promise<IClassifiedFeatureTree> => {
  throw new Error('Not implemented — classification requires AI integration');
};
