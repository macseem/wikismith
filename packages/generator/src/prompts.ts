import type { IFeatureNode } from '@wikismith/shared';

const extensionToLanguage: Record<string, string> = {
  ts: 'ts',
  tsx: 'tsx',
  js: 'js',
  jsx: 'jsx',
  mjs: 'js',
  cjs: 'js',
  json: 'json',
  md: 'md',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'toml',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  py: 'python',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  java: 'java',
  kt: 'kotlin',
  swift: 'swift',
  php: 'php',
  css: 'css',
  scss: 'scss',
  html: 'html',
  xml: 'xml',
  sql: 'sql',
  dockerfile: 'dockerfile',
};

const getFenceLanguage = (filePath: string): string => {
  const normalizedPath = filePath.toLowerCase();
  if (normalizedPath.endsWith('/dockerfile') || normalizedPath === 'dockerfile') {
    return 'dockerfile';
  }

  const extension = normalizedPath.split('.').pop();
  if (!extension) {
    return 'text';
  }

  return extensionToLanguage[extension] ?? 'text';
};

const truncateFileContent = (content: string): string => {
  if (content.length <= 3500) {
    return content;
  }

  return `${content.slice(0, 3500)}\n... [truncated for prompt]`;
};

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
      const truncated = truncateFileContent(content);
      const language = getFenceLanguage(rf.path);
      return `### ${rf.path}\nRole: ${rf.role}\n\`\`\`${language}\n${truncated}\n\`\`\``;
    })
    .join('\n\n');

  const githubBase = `https://github.com/${repoFullName}/blob/${commitSha}`;
  const citationExamplePath = feature.relevantFiles[0]?.path ?? 'src/path/to/file.ts';
  const citationExample = `[
\`${citationExamplePath}:12-28\`
](${githubBase}/${citationExamplePath}#L12-L28)`.replace(/\n/g, '');

  return `You are a technical writer creating a wiki page for the "${feature.name}" feature of the ${repoFullName} repository.

## Feature
Name: ${feature.name}
Description: ${feature.description}

## Relevant Source Files
${fileSnippets}

## Instructions
Write a clean, scannable wiki page in Markdown. Follow these strict rules:
1. Do NOT add a page title heading — the wiki system adds it.
2. Use exactly these H2 sections in order:
   - ## Overview
   - ## User-facing behavior
   - ## Architecture and data flow
   - ## Key implementation details
   - ## Key files
3. Prefer bullets over dense paragraphs; keep paragraphs to 2-4 sentences max.
4. Under "Key implementation details", include 1-4 fenced code blocks and EVERY block must have a language tag (for example \`\`\`ts, \`\`\`bash, \`\`\`json).
5. Every non-trivial technical claim must include at least one inline citation in this format: ${citationExample}
6. In "Key files", list bullets as: - \`path/to/file\` - one line on why it matters + citation.
7. Stay grounded in provided files only. If something is unknown, explicitly say it is not shown in the provided source snippets.
8. Write for engineers new to the codebase. Be concise but thorough (around 450-1100 words).

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

  const readmeSection = readmeContent ? `## Original README\n${readmeContent.slice(0, 2000)}` : '';

  return `You are a technical writer creating an overview page for the ${repoFullName} wiki.

## Detected Features
${featureList}

${readmeSection}

## Instructions
Write a polished overview page in Markdown. Follow these rules:
1. Do NOT add a page title heading — the wiki system adds it.
2. Use these sections in order:
   - ## What this project does
   - ## Main capabilities
   - ## Architecture overview
   - ## Getting started (only if setup steps are available)
3. "Main capabilities" must be a bullet list with short, concrete descriptions.
4. Avoid walls of text; keep paragraphs compact and scannable.
5. If you mention a setup command, format it as a fenced code block with a language tag (usually \`\`\`bash).
6. Keep it concise (around 250-700 words).

Respond with ONLY the Markdown content (no wrapping code fences).`;
};
