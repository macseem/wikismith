export interface IFeatureNode {
  id: string;
  name: string;
  description: string;
  relevantFiles: Array<{
    path: string;
    role: string;
  }>;
  children: IFeatureNode[];
}

export interface IClassifiedFeatureTree {
  repoId: string;
  commitSha: string;
  features: IFeatureNode[];
  generatedAt: string;
}
