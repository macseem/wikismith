import type { IClassifiedFeatureTree, IWikiPage, ICitation } from '@wikismith/shared';
import OpenAI from 'openai';
import { buildWikiPagePrompt, buildOverviewPrompt } from './prompts';

export interface GenerateOptions {
  openaiApiKey?: string;
  model?: string;
  onProgress?: (completed: number, total: number) => void;
}

export interface GenerateInput {
  featureTree: IClassifiedFeatureTree;
  fileContents: Record<string, string>;
  repoFullName: string;
  commitSha: string;
  readmeContent?: string;
}

const slugify = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const extractCitations = (content: string, repoFullName: string, commitSha: string): ICitation[] => {
  const citations: ICitation[] = [];
  const citationRe = /\[`([^`]+?):(\d+)-(\d+)`\]\(([^)]+)\)/g;

  let match;
  while ((match = citationRe.exec(content)) !== null) {
    citations.push({
      text: match[0]!,
      filePath: match[1]!,
      startLine: parseInt(match[2]!, 10),
      endLine: parseInt(match[3]!, 10),
      url: match[4] ?? `https://github.com/${repoFullName}/blob/${commitSha}/${match[1]}`,
    });
  }

  return citations;
};

export const generateWiki = async (
  input: GenerateInput,
  opts?: GenerateOptions,
): Promise<IWikiPage[]> => {
  const openai = new OpenAI({ apiKey: opts?.openaiApiKey ?? process.env['OPENAI_API_KEY'] });
  const model = opts?.model ?? 'gpt-4o-mini';
  const pages: IWikiPage[] = [];
  const totalPages = input.featureTree.features.length + 1;
  let completed = 0;

  // Generate overview page
  const overviewResponse = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: 'user',
        content: buildOverviewPrompt(
          input.featureTree.features,
          input.repoFullName,
          input.readmeContent,
        ),
      },
    ],
    temperature: 0.3,
  });

  const overviewContent = overviewResponse.choices[0]?.message?.content ?? '';
  pages.push({
    id: 'overview',
    featureId: 'overview',
    slug: 'overview',
    title: 'Overview',
    content: overviewContent,
    citations: [],
    parentPageId: null,
    order: 0,
  });

  completed++;
  opts?.onProgress?.(completed, totalPages);

  // Generate feature pages
  for (let i = 0; i < input.featureTree.features.length; i++) {
    const feature = input.featureTree.features[i]!;
    const prompt = buildWikiPagePrompt(
      feature,
      input.fileContents,
      input.repoFullName,
      input.commitSha,
    );

    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content ?? '';
    const citations = extractCitations(content, input.repoFullName, input.commitSha);

    pages.push({
      id: feature.id,
      featureId: feature.id,
      slug: slugify(feature.name),
      title: feature.name,
      content,
      citations,
      parentPageId: 'overview',
      order: i + 1,
    });

    // Generate sub-feature pages
    for (let j = 0; j < feature.children.length; j++) {
      const child = feature.children[j]!;
      const childPrompt = buildWikiPagePrompt(
        child,
        input.fileContents,
        input.repoFullName,
        input.commitSha,
      );

      const childResponse = await openai.chat.completions.create({
        model,
        messages: [{ role: 'user', content: childPrompt }],
        temperature: 0.3,
      });

      const childContent = childResponse.choices[0]?.message?.content ?? '';
      const childCitations = extractCitations(childContent, input.repoFullName, input.commitSha);

      pages.push({
        id: child.id,
        featureId: child.id,
        slug: slugify(child.name),
        title: child.name,
        content: childContent,
        citations: childCitations,
        parentPageId: feature.id,
        order: j + 1,
      });
    }

    completed++;
    opts?.onProgress?.(completed, totalPages);
  }

  return pages;
};
