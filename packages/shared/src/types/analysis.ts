export interface IFileEntry {
  path: string;
  language: string | null;
  sizeBytes: number;
  isEntryPoint: boolean;
  importanceScore: number;
  signatures: string[];
}

export interface IImportEdge {
  source: string;
  target: string;
}

export interface IAnalysisResult {
  files: IFileEntry[];
  importGraph: IImportEdge[];
  languages: Record<string, number>;
  frameworks: string[];
  entryPoints: string[];
  documentation: Array<{ path: string; content: string }>;
}
