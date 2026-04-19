import { Injectable } from '@nestjs/common';

const MAX_CHARS = 40_000;

@Injectable()
export class TextExtractor {
  extract(buffer: Buffer, filename?: string): string {
    const text = buffer.toString('utf-8');
    if (!text.trim()) return '[File is empty]';

    const truncated = text.length > MAX_CHARS
      ? text.slice(0, MAX_CHARS) + '\n\n[...truncated]'
      : text;

    const label = filename ? `[File: ${filename}]` : '[Text file]';
    return `${label}\n\n${truncated}`;
  }
}
