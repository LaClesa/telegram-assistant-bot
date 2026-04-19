import { Logger } from '@nestjs/common';
import { Update, Command, Ctx } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { GoogleAuthService } from '../google/google-auth.service';
import { GoogleDocsService } from '../google/google-docs.service';
import { GoogleSheetsService } from '../google/google-sheets.service';
import { GoogleDriveService } from '../google/google-drive.service';
import { AIService } from '../ai/ai.service';
import { MemoryService } from '../memory/memory.service';
import { PermissionsService } from '../permissions/permissions.service';
import { PermissionScope } from '../database/entities/permission.entity';
import { FilesService } from '../files/files.service';
import { ImageExtractor } from '../files/extractors/image.extractor';
import { PdfExtractor } from '../files/extractors/pdf.extractor';
import { CsvExtractor } from '../files/extractors/csv.extractor';
import { ExcelExtractor } from '../files/extractors/excel.extractor';
import { TextExtractor } from '../files/extractors/text.extractor';

const WRITE_INTENT_PATTERN =
  /\[WRITE(?::([^\]]+))?\]/i;

@Update()
export class GoogleUpdate {
  private readonly logger = new Logger(GoogleUpdate.name);

  constructor(
    private readonly googleAuth: GoogleAuthService,
    private readonly googleDocs: GoogleDocsService,
    private readonly googleSheets: GoogleSheetsService,
    private readonly googleDrive: GoogleDriveService,
    private readonly ai: AIService,
    private readonly memory: MemoryService,
    private readonly permissions: PermissionsService,
    private readonly files: FilesService,
    private readonly imageExtractor: ImageExtractor,
    private readonly pdfExtractor: PdfExtractor,
    private readonly csvExtractor: CsvExtractor,
    private readonly excelExtractor: ExcelExtractor,
    private readonly textExtractor: TextExtractor,
  ) {}

  // ─── /connect ─────────────────────────────────────────────────────────────

  @Command('connect')
  async onConnect(@Ctx() ctx: Context) {
    const telegramId = String(ctx.from?.id);

    const isConnected = await this.googleAuth.isConnected(telegramId);
    if (isConnected) {
      const email = await this.googleAuth.getConnectedEmail(telegramId);
      await ctx.reply(
        `✅ Google account already connected (${email ?? 'email unknown'}).\n\nUse /disconnect to unlink it.`,
      );
      return;
    }

    try {
      const url = await this.googleAuth.getAuthUrl(telegramId);
      await ctx.reply(
        `🔗 *Connect your Google account*\n\n` +
          `Click the link below to authorize access to Google Docs, Sheets, and Drive:\n\n` +
          `${url}\n\n` +
          `_The link expires in 10 minutes._`,
        { parse_mode: 'Markdown' },
      );
    } catch (err) {
      this.logger.error('Failed to generate auth URL', err);
      await ctx.reply('Sorry, failed to generate the authorization link. Please try again.');
    }
  }

  // ─── /disconnect ──────────────────────────────────────────────────────────

  @Command('disconnect')
  async onDisconnect(@Ctx() ctx: Context) {
    const telegramId = String(ctx.from?.id);

    const isConnected = await this.googleAuth.isConnected(telegramId);
    if (!isConnected) {
      await ctx.reply('No Google account is connected. Use /connect to link one.');
      return;
    }

    try {
      await this.googleAuth.revokeTokens(telegramId);
      await ctx.reply('✅ Google account disconnected. Your tokens have been deleted.');
    } catch (err) {
      this.logger.error('Failed to disconnect Google account', err);
      await ctx.reply('Something went wrong while disconnecting. Please try again.');
    }
  }

  // ─── /gdoc ────────────────────────────────────────────────────────────────

  @Command('gdoc')
  async onGdoc(@Ctx() ctx: Context) {
    const telegramId = String(ctx.from?.id);
    const text = this.getCommandArgs(ctx);
    if (!text) {
      await ctx.reply(
        'Usage: `/gdoc <url> [instruction]`\n\nExample:\n`/gdoc https://docs.google.com/... summarize this`',
        { parse_mode: 'Markdown' },
      );
      return;
    }

    const [urlOrId, ...rest] = text.split(' ');
    const instruction = rest.join(' ').trim();
    const docId = GoogleDocsService.extractDocId(urlOrId);

    if (!docId) {
      await ctx.reply('Could not extract a document ID from that URL. Please paste the full Google Docs URL.');
      return;
    }

    if (!(await this.googleAuth.isConnected(telegramId))) {
      await ctx.reply('Google account not connected. Use /connect first.');
      return;
    }

    await ctx.sendChatAction('typing');

    try {
      const docContent = await this.googleDocs.readDocument(telegramId, docId);
      const contextMessages = await this.memory.buildContextWindow(telegramId);

      const prompt = instruction
        ? `${instruction}\n\n${docContent}`
        : `Please analyse and summarise the following Google Doc:\n\n${docContent}`;

      const reply = await this.ai.sendMessage(prompt, contextMessages);

      // Detect write intent: AI signals [WRITE: <text to append>]
      const writeMatch = reply.match(WRITE_INTENT_PATTERN);
      if (writeMatch) {
        const writeGranted = await this.permissions.checkPermission(telegramId, PermissionScope.DOCUMENT_MODIFY);
        if (!writeGranted) {
          await ctx.reply(
            this.permissions.buildRequestMessage(PermissionScope.DOCUMENT_MODIFY),
            { parse_mode: 'Markdown' },
          );
          return;
        }
        const textToWrite = writeMatch[1] ?? '';
        if (textToWrite) {
          await this.googleDocs.appendContent(telegramId, docId, textToWrite);
        }
      }

      await this.memory.saveExchange(telegramId, instruction || '[read gdoc]', reply);
      await this.sendLongMessage(ctx, reply);
    } catch (err) {
      this.logger.error('gdoc command failed', err);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      await ctx.reply(`Failed to access the document: ${msg}`);
    }
  }

  // ─── /gsheet ──────────────────────────────────────────────────────────────

  @Command('gsheet')
  async onGsheet(@Ctx() ctx: Context) {
    const telegramId = String(ctx.from?.id);
    const text = this.getCommandArgs(ctx);
    if (!text) {
      await ctx.reply(
        'Usage: `/gsheet <url> [range] [instruction]`\n\nExample:\n`/gsheet https://docs.google.com/... Sheet1!A1:E20 summarize`',
        { parse_mode: 'Markdown' },
      );
      return;
    }

    const parts = text.split(' ');
    const urlOrId = parts[0];
    const sheetId = GoogleSheetsService.extractSheetId(urlOrId);

    if (!sheetId) {
      await ctx.reply('Could not extract a spreadsheet ID from that URL. Please paste the full Google Sheets URL.');
      return;
    }

    if (!(await this.googleAuth.isConnected(telegramId))) {
      await ctx.reply('Google account not connected. Use /connect first.');
      return;
    }

    // Second token could be a range (contains !) or start of instruction
    let range: string | undefined;
    let instruction: string;
    if (parts[1]?.includes('!') || /^[A-Z]+\d*:[A-Z]+\d*$/.test(parts[1] ?? '')) {
      range = parts[1];
      instruction = parts.slice(2).join(' ').trim();
    } else {
      instruction = parts.slice(1).join(' ').trim();
    }

    await ctx.sendChatAction('typing');

    try {
      const sheetContent = await this.googleSheets.readSheet(telegramId, sheetId, range);
      const contextMessages = await this.memory.buildContextWindow(telegramId);

      const prompt = instruction
        ? `${instruction}\n\n${sheetContent}`
        : `Please analyse and summarise the following spreadsheet data:\n\n${sheetContent}`;

      const reply = await this.ai.sendMessage(prompt, contextMessages);

      // Detect write intent
      const writeMatch = reply.match(WRITE_INTENT_PATTERN);
      if (writeMatch) {
        const writeGranted = await this.permissions.checkPermission(telegramId, PermissionScope.DOCUMENT_MODIFY);
        if (!writeGranted) {
          await ctx.reply(
            this.permissions.buildRequestMessage(PermissionScope.DOCUMENT_MODIFY),
            { parse_mode: 'Markdown' },
          );
          return;
        }
      }

      await this.memory.saveExchange(telegramId, instruction || '[read gsheet]', reply);
      await this.sendLongMessage(ctx, reply);
    } catch (err) {
      this.logger.error('gsheet command failed', err);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      await ctx.reply(`Failed to access the spreadsheet: ${msg}`);
    }
  }

  // ─── /gdrive ──────────────────────────────────────────────────────────────

  @Command('gdrive')
  async onGdrive(@Ctx() ctx: Context) {
    const telegramId = String(ctx.from?.id);
    const arg = this.getCommandArgs(ctx).trim();

    if (!(await this.googleAuth.isConnected(telegramId))) {
      await ctx.reply('Google account not connected. Use /connect first.');
      return;
    }

    await ctx.sendChatAction('typing');

    try {
      // If arg looks like a file ID (long alphanumeric), download and analyse it
      if (/^[a-zA-Z0-9_-]{25,}$/.test(arg)) {
        await this.analysedriveFile(ctx, telegramId, arg);
        return;
      }

      // Otherwise treat as a search query (or list all if empty)
      const listing = await this.googleDrive.listFiles(telegramId, arg || undefined);
      await this.sendLongMessage(ctx, listing);
    } catch (err) {
      this.logger.error('gdrive command failed', err);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      await ctx.reply(`Failed to access Google Drive: ${msg}`);
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async analysedriveFile(ctx: Context, telegramId: string, fileId: string): Promise<void> {
    const { buffer, mimeType, name } = await this.googleDrive.downloadFile(telegramId, fileId);
    const contextMessages = await this.memory.buildContextWindow(telegramId);

    let extractedContent: string;

    if (mimeType.startsWith('image/')) {
      const imageData = this.imageExtractor.extract(buffer, mimeType);
      const reply = await this.ai.sendMessageWithImage(imageData, `Analyse this image from Google Drive: ${name}`, contextMessages);
      await this.memory.saveExchange(telegramId, `[gdrive image: ${name}]`, reply);
      await this.sendLongMessage(ctx, reply);
      return;
    } else if (mimeType === 'application/pdf') {
      extractedContent = await this.pdfExtractor.extract(buffer);
    } else if (mimeType === 'text/csv') {
      extractedContent = this.csvExtractor.extract(buffer);
    } else if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
      extractedContent = this.excelExtractor.extract(buffer);
    } else {
      extractedContent = this.textExtractor.extract(buffer, name);
    }

    const prompt = `Please analyse the following file from Google Drive (${name}):\n\n${extractedContent}`;
    const reply = await this.ai.sendMessage(prompt, contextMessages);
    await this.memory.saveExchange(telegramId, `[gdrive file: ${name}]`, reply);
    await this.sendLongMessage(ctx, reply);
  }

  private getCommandArgs(ctx: Context): string {
    const message = ctx.message as { text?: string } | undefined;
    const text = message?.text ?? '';
    return text.replace(/^\/\w+\s*/, '').trim();
  }

  private async sendLongMessage(ctx: Context, text: string): Promise<void> {
    const LIMIT = 4096;
    if (text.length <= LIMIT) {
      await ctx.reply(text, { parse_mode: 'Markdown' });
      return;
    }
    for (let i = 0; i < text.length; i += LIMIT) {
      await ctx.reply(text.slice(i, i + LIMIT), { parse_mode: 'Markdown' });
    }
  }
}
