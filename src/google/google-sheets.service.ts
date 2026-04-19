import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { GoogleAuthService } from './google-auth.service';

const MAX_ROWS = 200;
const MAX_COL_WIDTH = 30;
const DEFAULT_RANGE = 'Sheet1';

@Injectable()
export class GoogleSheetsService {
  private readonly logger = new Logger(GoogleSheetsService.name);

  constructor(private readonly googleAuth: GoogleAuthService) {}

  /** Extract spreadsheet ID from a Google Sheets URL or return as-is */
  static extractSheetId(urlOrId: string): string | null {
    const match = urlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
    if (/^[a-zA-Z0-9_-]{25,}$/.test(urlOrId)) return urlOrId;
    return null;
  }

  /** Read a sheet range and return it as a markdown table string */
  async readSheet(telegramId: string, spreadsheetId: string, range?: string): Promise<string> {
    const auth = await this.googleAuth.getClient(telegramId);
    const sheets = google.sheets({ version: 'v4', auth });

    const effectiveRange = range ?? DEFAULT_RANGE;

    // Get spreadsheet metadata for title
    const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'properties.title,sheets.properties.title' });
    const title = meta.data.properties?.title ?? 'Spreadsheet';
    const sheetNames = (meta.data.sheets ?? []).map((s) => s.properties?.title ?? '').filter(Boolean);

    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: effectiveRange,
    });

    const rows = (data.values ?? []) as string[][];
    if (!rows.length) return `[Google Sheet: ${title}] — Range "${effectiveRange}" is empty.`;

    const preview = rows.slice(0, MAX_ROWS);
    const truncated = rows.length > MAX_ROWS;
    const table = this.toMarkdownTable(preview);
    const footer = truncated ? `\n_Showing first ${MAX_ROWS} of ${rows.length} rows._` : '';
    const sheetsLine = sheetNames.length > 1 ? `Sheets: ${sheetNames.join(', ')}\n` : '';

    this.logger.debug(`Read sheet "${title}" range=${effectiveRange} rows=${rows.length}`);
    return `[Google Sheet: ${title}]\n${sheetsLine}\n${table}${footer}`;
  }

  /** Write values to a range (A1 notation) */
  async updateRange(
    telegramId: string,
    spreadsheetId: string,
    range: string,
    values: string[][],
  ): Promise<void> {
    const auth = await this.googleAuth.getClient(telegramId);
    const sheets = google.sheets({ version: 'v4', auth });

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });

    this.logger.debug(`Updated sheet ${spreadsheetId} range=${range} rows=${values.length}`);
  }

  private toMarkdownTable(rows: string[][]): string {
    if (!rows.length) return '';

    const truncateCell = (val: unknown) => {
      const str = String(val ?? '');
      return str.length > MAX_COL_WIDTH ? str.slice(0, MAX_COL_WIDTH - 1) + '…' : str;
    };

    const cols = Math.max(...rows.map((r) => r.length));
    const [header, ...body] = rows;
    const paddedHeader = Array.from({ length: cols }, (_, i) => truncateCell(header[i] ?? ''));
    const headerRow = '| ' + paddedHeader.join(' | ') + ' |';
    const separator = '| ' + Array(cols).fill('---').join(' | ') + ' |';
    const dataRows = body.map(
      (row) => '| ' + Array.from({ length: cols }, (_, i) => truncateCell(row[i] ?? '')).join(' | ') + ' |',
    );

    return [headerRow, separator, ...dataRows].join('\n');
  }
}
