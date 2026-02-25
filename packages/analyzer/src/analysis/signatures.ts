import { extname } from 'node:path';

export interface Signature {
  name: string;
  kind: 'function' | 'class' | 'type' | 'interface' | 'variable' | 'enum';
  exported: boolean;
  line: number;
}

const TS_EXPORT_RE =
  /^(export\s+(?:default\s+)?)?(?:(function|class|interface|type|enum|const|let|var)\s+)(\w+)/gm;

const PY_DEF_RE = /^(class|def)\s+(\w+)/gm;

export const extractSignatures = (filePath: string, content: string): Signature[] => {
  const ext = extname(filePath).toLowerCase();
  const signatures: Signature[] = [];

  if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      TS_EXPORT_RE.lastIndex = 0;
      const match = TS_EXPORT_RE.exec(line);
      if (match) {
        const exported = !!match[1]?.includes('export');
        const keyword = match[2]!;
        const name = match[3]!;
        const kind = mapJsKeywordToKind(keyword);
        signatures.push({ name, kind, exported, line: i + 1 });
      }
    }
  }

  if (ext === '.py') {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      PY_DEF_RE.lastIndex = 0;
      const match = PY_DEF_RE.exec(line);
      if (match) {
        const keyword = match[1]!;
        const name = match[2]!;
        const exported = !name.startsWith('_');
        signatures.push({
          name,
          kind: keyword === 'class' ? 'class' : 'function',
          exported,
          line: i + 1,
        });
      }
    }
  }

  return signatures;
};

const mapJsKeywordToKind = (kw: string): Signature['kind'] => {
  switch (kw) {
    case 'function':
      return 'function';
    case 'class':
      return 'class';
    case 'interface':
      return 'interface';
    case 'type':
      return 'type';
    case 'enum':
      return 'enum';
    default:
      return 'variable';
  }
};
