import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import { list as tarList, type ReadEntry } from 'tar';
import { IngestionError } from '@wikismith/shared';
import {
  BINARY_EXTENSIONS,
  DEFAULT_IGNORE_PATTERNS,
  MAX_FILE_COUNT,
  MAX_FILE_SIZE_BYTES,
  MAX_TOTAL_SIZE_BYTES,
} from './constants';
import { extname } from 'node:path';

export interface ExtractedFile {
  path: string;
  content: string | null;
  sizeBytes: number;
  isBinary: boolean;
}

export interface ExtractionResult {
  files: ExtractedFile[];
  fileTree: string[];
  totalSizeBytes: number;
}

const shouldIgnore = (filePath: string): boolean =>
  DEFAULT_IGNORE_PATTERNS.some((pattern) => {
    if (pattern.endsWith('/')) {
      return filePath.includes(pattern) || filePath.split('/').includes(pattern.slice(0, -1));
    }
    if (pattern.startsWith('*')) {
      return filePath.endsWith(pattern.slice(1));
    }
    return filePath.includes('/' + pattern) || filePath === pattern;
  });

const isBinary = (filePath: string): boolean => {
  const ext = extname(filePath).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
};

export const extractTarball = async (tarballBuffer: ArrayBuffer): Promise<ExtractionResult> => {
  const files: ExtractedFile[] = [];
  const fileTree: string[] = [];
  let totalSizeBytes = 0;
  let limitExceeded: 'files' | 'size' | null = null;

  const gunzip = createGunzip();
  const readable = Readable.from(Buffer.from(tarballBuffer));

  const extractor = tarList({
    onReadEntry: (entry: ReadEntry) => {
      const fullPath = entry.path;
      const slashIdx = fullPath.indexOf('/');
      const relativePath = slashIdx >= 0 ? fullPath.slice(slashIdx + 1) : fullPath;

      if (!relativePath || entry.type !== 'File') {
        entry.resume();
        return;
      }

      fileTree.push(relativePath);

      if (fileTree.length > MAX_FILE_COUNT) {
        limitExceeded = 'files';
        entry.resume();
        return;
      }

      if (shouldIgnore(relativePath)) {
        entry.resume();
        return;
      }

      const sizeBytes = entry.size ?? 0;
      totalSizeBytes += sizeBytes;

      if (totalSizeBytes > MAX_TOTAL_SIZE_BYTES) {
        limitExceeded = 'size';
        entry.resume();
        return;
      }

      if (isBinary(relativePath)) {
        files.push({ path: relativePath, content: null, sizeBytes, isBinary: true });
        entry.resume();
        return;
      }

      if (sizeBytes > MAX_FILE_SIZE_BYTES) {
        files.push({ path: relativePath, content: null, sizeBytes, isBinary: false });
        entry.resume();
        return;
      }

      const chunks: Buffer[] = [];
      entry.on('data', (chunk: Buffer) => chunks.push(chunk));
      entry.on('end', () => {
        const content = Buffer.concat(chunks).toString('utf-8');
        files.push({ path: relativePath, content, sizeBytes, isBinary: false });
      });
    },
  });

  await pipeline(readable, gunzip, extractor);

  if (limitExceeded === 'files') {
    throw new IngestionError(
      `Repository exceeds maximum file count (${MAX_FILE_COUNT} files). Consider a smaller repository or a specific branch.`,
      'REPO_TOO_LARGE',
      413,
    );
  }

  if (limitExceeded === 'size') {
    throw new IngestionError(
      `Repository exceeds maximum total size (${Math.round(MAX_TOTAL_SIZE_BYTES / 1_000_000)}MB). Consider a smaller repository.`,
      'REPO_TOO_LARGE',
      413,
    );
  }

  return { files, fileTree, totalSizeBytes };
};
