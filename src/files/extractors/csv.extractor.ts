import { Injectable, Logger } from '@nestjs/common';
import { parse } from 'csv-parse/sync';

const MAX_ROWS = 200;
const MAX_COL_WIDTH = 40;

@Injectable()
export class CsvExtractor {
  private readonly logger = new Logger(CsvExtractor.name);

  extract(buffer: Buffer): string {
    try {
      const records = parse(buffer.toString('utf-8'), {
        skip_empty_lines: true,
        trim: true,
      }) as string[][];

      if (!records.length) return '[CSV file is empty]';

      const preview = records.slice(0, MAX_ROWS);
      const truncated = records.length > MAX_ROWS;

      const table = this.toMarkdownTable(preview);
      const footer = truncated
        ? `\n\n_Showing first ${MAX_ROWS} of ${records.length} rows._`
        : '';

      return `[CSV — ${records.length} row${records.length === 1 ? '' : 's'}]\n\n${table}${footer}`;
    } catch (err) {
      this.logger.error('CSV extraction failed', err);
      throw new Error('Could not parse the CSV file. Please check it is valid UTF-8 CSV.');
    }
  }

  private toMarkdownTable(rows: string[][]): string {
    if (!rows.length) return '';

    const truncateCell = (val: string) =>
      val.length > MAX_COL_WIDTH ? val.slice(0, MAX_COL_WIDTH - 1) + '…' : val;

    const [header, ...body] = rows;
    const cols = header.length;
    const headerRow = '| ' + header.map(truncateCell).join(' | ') + ' |';
    const separator = '| ' + Array(cols).fill('---').join(' | ') + ' |';
    const dataRows = body.map(
      (row) =>
        '| ' +
        Array.from({ length: cols }, (_, i) => truncateCell(row[i] ?? '')).join(' | ') +
        ' |',
    );

    return [headerRow, separator, ...dataRows].join('\n');
  }
}
