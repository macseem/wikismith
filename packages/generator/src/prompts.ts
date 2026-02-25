import type { IFeatureNode } from '@wikismith/shared';

export const buildWikiPagePrompt = (
  feature: IFeatureNode,
  fileContents: Record<string, string>,
  repoFullName: string,
  commitSha: string,
): string => {
  const fileSnippets = feature.relevantFiles
    .map((rf) => {
      const content = fileContents[rf.path];
      if (!content) return `### ${rf.path}\n_File not available_\nRole: ${rf.role}`;
      const truncated = content.length > 3000 ? content.slice(0, 3000) + '\n// ... truncated' : content;
      return `### ${rf.path}\nRole: ${rf.role}\n\`\`\`\n${truncated}\n\`\`\``;
    })
    .join('\n\n');

  const githubBase = `https://github.com/${repoFullName}/blob/${commitSha}`;

  return `You are a technical writer creating a wiki page for the "${feature.name}" feature of the ${repoFullName} repository.

## Feature
Name: ${feature.name}
Description: ${feature.description}

## Relevant Source Files
${fileSnippets}

## Instructions
Write a clear, comprehensive wiki page in Markdown. Rules:
1. Start with a brief overview of what this feature does from a USER perspective.
2. Explain HOW it works at a high level — architecture, data flow, key components.
3. Include inline code citations using this format: [\`filename:startLine-endLine\`](${githubBase}/path#L1-L10)
4. Use code blocks for important snippets.
5. Include a "Key Files" section at the end listing each file with a one-line description.
6. Write for a developer who is new to the codebase.
7. Do NOT add a title heading — the wiki system adds it.
8. Be concise but thorough — aim for 500-1500 words.

Respond with ONLY the Markdown content (no wrapping code fences).`;
};

export const buildOverviewPrompt = (
  features: IFeatureNode[],
  repoFullName: string,
  readmeContent?: string,
): string => {
  const featureList = features
    .map((f) => `- **${f.name}**: ${f.description} (${f.relevantFiles.length} files)`)
    .join('\n');

  const readmeSection = readmeContent
    ? `## Original README\n${readmeContent.slice(0, 2000)}`
    : '';

  return `You are a technical writer creating an overview page for the ${repoFullName} wiki.

## Detected Features
${featureList}

${readmeSection}

## Instructions
Write a wiki overview page in Markdown. Rules:
1. Start with a concise description of what this project does.
2. List the main features/capabilities with brief descriptions.
3. Include a "Getting Started" section if the README has setup instructions.
4. Include an "Architecture Overview" section describing how features relate.
5. Do NOT add a title heading — the wiki system adds it.
6. Be concise — aim for 300-800 words.

Respond with ONLY the Markdown content (no wrapping code fences).`;
};
