import { Injectable, Logger } from '@nestjs/common';
import * as XLSX from 'xlsx';

const MAX_ROWS = 200;
const MAX_COL_WIDTH = 40;

@Injectable()
export class ExcelExtractor {
  private readonly logger = new Logger(ExcelExtractor.name);

  extract(buffer: Buffer): string {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetNames = workbook.SheetNames;

      if (!sheetNames.length) return '[Excel file contains no sheets]';

      const results: string[] = [];

      for (const name of sheetNames) {
        const sheet = workbook.Sheets[name];
        const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' });

        if (!rows.length) {
          results.push(`**Sheet: ${name}** — empty`);
          continue;
        }

        const preview = rows.slice(0, MAX_ROWS) as string[][];
        const truncated = rows.length > MAX_ROWS;
        const table = this.toMarkdownTable(preview);
        const footer = truncated
          ? `\n_Showing first ${MAX_ROWS} of ${rows.length} rows._`
          : '';

        results.push(`**Sheet: ${name}** (${rows.length} rows)\n\n${table}${footer}`);
      }

      return `[Excel — ${sheetNames.length} sheet${sheetNames.length === 1 ? '' : 's'}]\n\n` +
        results.join('\n\n---\n\n');
    } catch (err) {
      this.logger.error('Excel extraction failed', err);
      throw new Error('Could not parse the Excel file. Supported formats: .xlsx, .xls, .ods');
    }
  }

  private toMarkdownTable(rows: string[][]): string {
    if (!rows.length) return '';

    const truncateCell = (val: unknown) => {
      const str = String(val ?? '');
      return str.length > MAX_COL_WIDTH ? str.slice(0, MAX_COL_WIDTH - 1) + '…' : str;
    };

    const [header, ...body] = rows;
    const cols = header.length || 1;
    const headerRow = '| ' + header.map(truncateCell).join(' | ') + ' |';
    const separator = '| ' + Array(cols).fill('---').join(' | ') + ' |';
    const dataRows = body.map(
      (row) =>
        '| ' +
        Array.from({ length: cols }, (_, i) => truncateCell(row[i])).join(' | ') +
        ' |',
    );

    return [headerRow, separator, ...dataRows].join('\n');
  }
}
