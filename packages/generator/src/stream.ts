import type { IClassifiedFeatureTree, IWikiPage } from '@wikismith/shared';
import OpenAI from 'openai';
import { buildWikiPagePrompt } from './prompts';

export interface StreamGenerateOptions {
  openaiApiKey?: string;
  model?: string;
}

export async function* streamWikiPage(
  feature: IClassifiedFeatureTree['features'][number],
  fileContents: Record<string, string>,
  repoFullName: string,
  commitSha: string,
  opts?: StreamGenerateOptions,
): AsyncGenerator<string> {
  const openai = new OpenAI({ apiKey: opts?.openaiApiKey ?? process.env['OPENAI_API_KEY'] });
  const model = opts?.model ?? 'gpt-4o-mini';

  const prompt = buildWikiPagePrompt(feature, fileContents, repoFullName, commitSha);

  const stream = await openai.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}
