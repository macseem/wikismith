export interface ICitation {
  text: string;
  filePath: string;
  startLine: number;
  endLine: number;
  url: string;
}

export interface IWikiPage {
  id: string;
  featureId: string;
  slug: string;
  title: string;
  content: string;
  citations: ICitation[];
  parentPageId: string | null;
  order: number;
}
