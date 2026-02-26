const MARKDOWN_BLOCK_PREFIX_PATTERN = /^([#>|*+-]|\d+\.)\s/;
const TITLE_CASE_SECTION_PATTERN = /^[A-Z][A-Za-z0-9&/()+ -]{2,60}$/;
const TRAILING_COLON_SECTION_PATTERN = /^[A-Z][A-Za-z0-9&/()+ -]{2,60}:$/;
const BOLD_LABEL_LINE_PATTERN = /^\*\*[^*\n]+:\*\*\s+\S/;

const getNearestNonEmptyLine = (lines: string[], startIndex: number, direction: 1 | -1): string => {
  for (let i = startIndex; i >= 0 && i < lines.length; i += direction) {
    const line = lines[i]?.trim() ?? '';
    if (line.length > 0) {
      return line;
    }
  }

  return '';
};

export const normalizeWikiMarkdownForRender = (content: string): string => {
  if (content.trim().length === 0) {
    return content;
  }

  const lines = content.split('\n');
  const normalized: string[] = [];
  let inCodeFence = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      inCodeFence = !inCodeFence;
      normalized.push(line);
      continue;
    }

    if (inCodeFence || trimmed.length === 0) {
      normalized.push(line);
      continue;
    }

    if (MARKDOWN_BLOCK_PREFIX_PATTERN.test(trimmed)) {
      normalized.push(line);
      continue;
    }

    if (BOLD_LABEL_LINE_PATTERN.test(trimmed)) {
      normalized.push(`- ${trimmed}`);
      continue;
    }

    const previousLine = getNearestNonEmptyLine(lines, index - 1, -1);
    const nextLine = getNearestNonEmptyLine(lines, index + 1, 1);
    const hasFollowingContext = nextLine.length > 0;
    if (!hasFollowingContext || previousLine.endsWith(':')) {
      normalized.push(line);
      continue;
    }

    if (TITLE_CASE_SECTION_PATTERN.test(trimmed)) {
      normalized.push(`## ${trimmed}`);
      continue;
    }

    if (TRAILING_COLON_SECTION_PATTERN.test(trimmed)) {
      normalized.push(`## ${trimmed.slice(0, -1)}`);
      continue;
    }

    normalized.push(line);
  }

  return normalized.join('\n');
};
