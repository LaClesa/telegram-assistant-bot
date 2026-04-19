import { Injectable, Logger } from '@nestjs/common';
// pdf-parse has no default export type; use require
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string; numpages: number }>;

const MAX_CHARS = 40_000; // keep context window manageable

@Injectable()
export class PdfExtractor {
  private readonly logger = new Logger(PdfExtractor.name);

  async extract(buffer: Buffer): Promise<string> {
    try {
      const result = await pdfParse(buffer);
      const text = result.text.trim();
      const pages = result.numpages;

      if (!text) return '[PDF contained no extractable text]';

      const truncated = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) + '\n\n[...truncated]' : text;
      return `[PDF — ${pages} page${pages === 1 ? '' : 's'}]\n\n${truncated}`;
    } catch (err) {
      this.logger.error('PDF extraction failed', err);
      throw new Error('Could not extract text from the PDF. It may be scanned or encrypted.');
    }
  }
}
