import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { GoogleAuthService } from './google-auth.service';

const MAX_LIST_FILES = 20;

const MIME_ICONS: Record<string, string> = {
  'application/vnd.google-apps.document': '📄',
  'application/vnd.google-apps.spreadsheet': '📊',
  'application/vnd.google-apps.presentation': '📑',
  'application/vnd.google-apps.folder': '📁',
  'application/pdf': '📕',
  'image/jpeg': '🖼',
  'image/png': '🖼',
};

@Injectable()
export class GoogleDriveService {
  private readonly logger = new Logger(GoogleDriveService.name);

  constructor(private readonly googleAuth: GoogleAuthService) {}

  /** List the most recently modified files, optionally filtered by a search query */
  async listFiles(telegramId: string, query?: string): Promise<string> {
    const auth = await this.googleAuth.getClient(telegramId);
    const drive = google.drive({ version: 'v3', auth });

    const q = query
      ? `name contains '${query.replace(/'/g, "\\'")}' and trashed = false`
      : 'trashed = false';

    const { data } = await drive.files.list({
      q,
      pageSize: MAX_LIST_FILES,
      orderBy: 'modifiedTime desc',
      fields: 'files(id, name, mimeType, modifiedTime, size)',
    });

    const files = data.files ?? [];
    if (!files.length) {
      return query
        ? `No files found matching "${query}".`
        : 'No files found in your Google Drive.';
    }

    const lines = files.map((f) => {
      const icon = MIME_ICONS[f.mimeType ?? ''] ?? '📎';
      const modified = f.modifiedTime ? new Date(f.modifiedTime).toLocaleDateString() : '';
      return `${icon} *${f.name}*\n   ID: \`${f.id}\`  •  ${modified}`;
    });

    const header = query
      ? `*Search results for "${query}" (${files.length} files):*\n\n`
      : `*Recent Drive files (${files.length}):*\n\n`;

    this.logger.debug(`Listed ${files.length} Drive files`);
    return header + lines.join('\n\n') + '\n\nUse `/gdrive <file-id>` to analyse a file.';
  }

  /**
   * Download a file by its Drive file ID as a Buffer.
   * For Google Workspace native formats (Docs, Sheets), exports to a suitable format.
   */
  async downloadFile(telegramId: string, fileId: string): Promise<{ buffer: Buffer; mimeType: string; name: string }> {
    const auth = await this.googleAuth.getClient(telegramId);
    const drive = google.drive({ version: 'v3', auth });

    // Get file metadata first
    const { data: meta } = await drive.files.get({
      fileId,
      fields: 'name, mimeType',
    });

    const name = meta.name ?? fileId;
    let mimeType = meta.mimeType ?? 'application/octet-stream';
    let exportMime: string | undefined;

    // Google Workspace formats need export
    if (mimeType === 'application/vnd.google-apps.document') {
      exportMime = 'text/plain';
      mimeType = 'text/plain';
    } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
      exportMime = 'text/csv';
      mimeType = 'text/csv';
    } else if (mimeType === 'application/vnd.google-apps.presentation') {
      exportMime = 'text/plain';
      mimeType = 'text/plain';
    }

    let buffer: Buffer;

    if (exportMime) {
      const res = await drive.files.export(
        { fileId, mimeType: exportMime },
        { responseType: 'arraybuffer' },
      );
      buffer = Buffer.from(res.data as ArrayBuffer);
    } else {
      const res = await drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'arraybuffer' },
      );
      buffer = Buffer.from(res.data as ArrayBuffer);
    }

    this.logger.debug(`Downloaded Drive file "${name}" (${buffer.length} bytes)`);
    return { buffer, mimeType, name };
  }
}
