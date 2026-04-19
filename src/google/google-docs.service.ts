import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { GoogleAuthService } from './google-auth.service';

const MAX_CONTENT_CHARS = 40_000;

@Injectable()
export class GoogleDocsService {
  private readonly logger = new Logger(GoogleDocsService.name);

  constructor(private readonly googleAuth: GoogleAuthService) {}

  /** Extract document ID from a Google Docs URL or return the value as-is if it looks like an ID */
  static extractDocId(urlOrId: string): string | null {
    const match = urlOrId.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
    if (/^[a-zA-Z0-9_-]{25,}$/.test(urlOrId)) return urlOrId;
    return null;
  }

  /** Read and return full plain-text content of a Google Doc */
  async readDocument(telegramId: string, docId: string): Promise<string> {
    const auth = await this.googleAuth.getClient(telegramId);
    const docs = google.docs({ version: 'v1', auth });

    const { data } = await docs.documents.get({ documentId: docId });
    const title = data.title ?? 'Untitled';

    const text = this.extractText(data);
    const truncated =
      text.length > MAX_CONTENT_CHARS ? text.slice(0, MAX_CONTENT_CHARS) + '\n\n[...truncated]' : text;

    this.logger.debug(`Read doc "${title}" (${text.length} chars)`);
    return `[Google Doc: ${title}]\n\n${truncated}`;
  }

  /** Append plain text to the end of a document */
  async appendContent(telegramId: string, docId: string, text: string): Promise<void> {
    const auth = await this.googleAuth.getClient(telegramId);
    const docs = google.docs({ version: 'v1', auth });

    // Get current doc end index
    const { data } = await docs.documents.get({ documentId: docId });
    const endIndex = data.body?.content?.at(-1)?.endIndex ?? 1;

    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: {
        requests: [
          {
            insertText: {
              location: { index: endIndex - 1 },
              text: `\n${text}`,
            },
          },
        ],
      },
    });

    this.logger.debug(`Appended ${text.length} chars to doc ${docId}`);
  }

  /** Walk the document body and join all text runs into a plain string */
  private extractText(doc: { body?: { content?: unknown[] } }): string {
    const paragraphs: string[] = [];

    const walk = (elements: unknown[]) => {
      for (const el of elements) {
        const element = el as Record<string, unknown>;
        if (element.paragraph) {
          const para = element.paragraph as { elements?: unknown[] };
          const line = (para.elements ?? [])
            .map((e) => {
              const elem = e as Record<string, unknown>;
              const textRun = elem.textRun as { content?: string } | undefined;
              return textRun?.content ?? '';
            })
            .join('');
          paragraphs.push(line);
        }
        if (element.table) {
          const table = element.table as { tableRows?: unknown[] };
          for (const row of table.tableRows ?? []) {
            const tableRow = row as { tableCells?: unknown[] };
            for (const cell of tableRow.tableCells ?? []) {
              const tableCell = cell as { content?: unknown[] };
              walk(tableCell.content ?? []);
            }
          }
        }
      }
    };

    walk((doc.body?.content ?? []) as unknown[]);
    return paragraphs.join('');
  }
}
