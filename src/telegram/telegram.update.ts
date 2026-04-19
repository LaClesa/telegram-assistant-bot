import { Logger } from '@nestjs/common';
import {
  Update,
  Start,
  Help,
  Command,
  On,
  Ctx,
  Message,
} from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { AIService } from '../ai/ai.service';
import { MemoryService } from '../memory/memory.service';
import { LongTermService } from '../memory/long-term.service';
import { ShortTermService } from '../memory/short-term.service';
import { PermissionsService } from '../permissions/permissions.service';
import { PermissionScope } from '../database/entities/permission.entity';
import { FilesService } from '../files/files.service';
import { ImageExtractor } from '../files/extractors/image.extractor';
import { PdfExtractor } from '../files/extractors/pdf.extractor';
import { CsvExtractor } from '../files/extractors/csv.extractor';
import { ExcelExtractor } from '../files/extractors/excel.extractor';
import { TextExtractor } from '../files/extractors/text.extractor';

// MIME types routed to each extractor
const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const PDF_MIMES = new Set(['application/pdf']);
const CSV_MIMES = new Set(['text/csv', 'text/plain']);
const EXCEL_MIMES = new Set([
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.spreadsheet',
]);
const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.ts', '.js', '.py', '.go', '.java', '.rb', '.php',
  '.json', '.yaml', '.yml', '.toml', '.xml', '.html', '.css', '.sh', '.env',
]);

@Update()
export class TelegramUpdate {
  private readonly logger = new Logger(TelegramUpdate.name);

  constructor(
    private readonly ai: AIService,
    private readonly memory: MemoryService,
    private readonly longTerm: LongTermService,
    private readonly shortTerm: ShortTermService,
    private readonly permissions: PermissionsService,
    private readonly files: FilesService,
    private readonly imageExtractor: ImageExtractor,
    private readonly pdfExtractor: PdfExtractor,
    private readonly csvExtractor: CsvExtractor,
    private readonly excelExtractor: ExcelExtractor,
    private readonly textExtractor: TextExtractor,
  ) {}

  @Start()
  async onStart(@Ctx() ctx: Context) {
    const user = ctx.from;
    if (!user) return;

    const telegramId = String(user.id);
    await this.longTerm.upsertUser(telegramId, user.username, user.first_name);

    const name = user.first_name ?? user.username ?? 'there';
    await ctx.reply(
      `Hello, ${name}! 👋\n\n` +
        `I'm your AI-powered personal assistant. I can help you with:\n` +
        `• Answering questions and having conversations\n` +
        `• Writing, reviewing, and debugging code\n` +
        `• Managing tasks and projects\n` +
        `• Analysing images, PDFs, CSVs, Excel files, and code files\n\n` +
        `Use /help to see all available commands.`,
      { parse_mode: 'Markdown' },
    );
  }

  @Help()
  async onHelp(@Ctx() ctx: Context) {
    await ctx.reply(
      `*Available commands:*\n\n` +
        `/start — Introduction and setup\n` +
        `/help — Show this message\n` +
        `/permissions — View and manage your permissions\n` +
        `/forget — Clear your current session memory\n\n` +
        `*Supported uploads:*\n` +
        `📷 Images — visual analysis\n` +
        `📄 PDF — text extraction + summary\n` +
        `📊 CSV / Excel — table analysis\n` +
        `💻 Text / code files — read and analyse\n\n` +
        `*Just send me a message* and I'll respond as your personal assistant. 🙂`,
      { parse_mode: 'Markdown' },
    );
  }

  @Command('permissions')
  async onPermissions(@Ctx() ctx: Context) {
    const telegramId = String(ctx.from?.id);
    const summary = await this.permissions.buildPermissionsSummary(telegramId);
    await ctx.reply(summary, { parse_mode: 'Markdown' });
  }

  @Command('forget')
  async onForget(@Ctx() ctx: Context) {
    const telegramId = String(ctx.from?.id);
    await this.shortTerm.clearSession(telegramId);
    await ctx.reply('Session memory cleared. Starting fresh! 🧹');
  }

  // ─── Photo handler ────────────────────────────────────────────────────────

  @On('photo')
  async onPhoto(@Ctx() ctx: Context) {
    const user = ctx.from;
    if (!user || !('photo' in ctx.message!)) return;
    if (ctx.chat?.type !== 'private') return; // groups handled by GroupUpdate

    const telegramId = String(user.id);

    if (!(await this.shortTerm.checkRateLimit(telegramId, this.rateLimitMax()))) {
      await ctx.reply('Please slow down — you\'ve sent too many messages. Try again in a moment.');
      return;
    }

    await ctx.sendChatAction('typing');

    // Telegram sends multiple sizes — use the highest resolution
    const photos = (ctx.message as { photo: Array<{ file_id: string }> }).photo;
    const bestPhoto = photos[photos.length - 1];
    const caption =
      'caption' in ctx.message! ? String((ctx.message as { caption?: string }).caption ?? '') : '';

    try {
      const { buffer, size } = await this.files.downloadFile(bestPhoto.file_id);

      if (this.files.isLargeFile(size)) {
        await ctx.reply('_Large image detected — this may take a moment to analyse._', {
          parse_mode: 'Markdown',
        });
      }

      const imageData = this.imageExtractor.extract(buffer, 'image/jpeg');
      const contextMessages = await this.memory.buildContextWindow(telegramId);
      const reply = await this.ai.sendMessageWithImage(imageData, caption, contextMessages);

      await this.memory.saveExchange(telegramId, caption || '[image]', reply);
      await this.memory.autoSummariseIfNeeded(telegramId);
      await this.sendLongMessage(ctx, reply);
    } catch (err) {
      this.logger.error('Photo handling failed', err);
      await ctx.reply('Sorry, I could not analyse that image. Please try again.');
    }
  }

  // ─── Document handler ─────────────────────────────────────────────────────

  @On('document')
  async onDocument(@Ctx() ctx: Context) {
    const user = ctx.from;
    if (!user || !('document' in ctx.message!)) return;
    if (ctx.chat?.type !== 'private') return; // groups handled by GroupUpdate

    const telegramId = String(user.id);

    if (!(await this.shortTerm.checkRateLimit(telegramId, this.rateLimitMax()))) {
      await ctx.reply('Please slow down — you\'ve sent too many messages. Try again in a moment.');
      return;
    }

    await ctx.sendChatAction('typing');

    const doc = (ctx.message as { document: { file_id: string; file_name?: string; mime_type?: string } }).document;
    const caption =
      'caption' in ctx.message! ? String((ctx.message as { caption?: string }).caption ?? '') : '';
    const filename = doc.file_name ?? 'unknown';
    const mimeType = (doc.mime_type ?? '').toLowerCase();
    const ext = filename.includes('.') ? '.' + filename.split('.').pop()!.toLowerCase() : '';

    try {
      const { buffer, size } = await this.files.downloadFile(doc.file_id);

      if (this.files.isLargeFile(size)) {
        await ctx.reply('_Large file detected — extraction may take a moment._', {
          parse_mode: 'Markdown',
        });
      }

      let extractedContent: string;
      let usedVision = false;

      if (IMAGE_MIMES.has(mimeType)) {
        // Document that is actually an image (e.g. sent as file not compressed photo)
        const imageData = this.imageExtractor.extract(buffer, mimeType);
        const contextMessages = await this.memory.buildContextWindow(telegramId);
        const reply = await this.ai.sendMessageWithImage(imageData, caption, contextMessages);
        await this.memory.saveExchange(telegramId, caption || `[image: ${filename}]`, reply);
        await this.sendLongMessage(ctx, reply);
        usedVision = true;
        return;
      } else if (PDF_MIMES.has(mimeType)) {
        extractedContent = await this.pdfExtractor.extract(buffer);
      } else if (CSV_MIMES.has(mimeType) || ext === '.csv') {
        extractedContent = this.csvExtractor.extract(buffer);
      } else if (EXCEL_MIMES.has(mimeType) || ext === '.xlsx' || ext === '.xls' || ext === '.ods') {
        extractedContent = this.excelExtractor.extract(buffer);
      } else if (TEXT_EXTENSIONS.has(ext) || mimeType.startsWith('text/')) {
        extractedContent = this.textExtractor.extract(buffer, filename);
      } else {
        await ctx.reply(
          `I don't know how to process *${filename}* (${mimeType || 'unknown type'}).\n\n` +
            `Supported: images, PDF, CSV, Excel (.xlsx/.xls), and text/code files.`,
          { parse_mode: 'Markdown' },
        );
        return;
      }

      if (!usedVision) {
        const userMessage = caption
          ? `${caption}\n\n${extractedContent}`
          : `Please analyse the following file and provide a helpful summary:\n\n${extractedContent}`;

        const contextMessages = await this.memory.buildContextWindow(telegramId);
        const reply = await this.ai.sendMessage(userMessage, contextMessages);

        await this.memory.saveExchange(telegramId, caption || `[file: ${filename}]`, reply);
        await this.memory.autoSummariseIfNeeded(telegramId);
        await this.sendLongMessage(ctx, reply);
      }
    } catch (err) {
      this.logger.error('Document handling failed', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      await ctx.reply(`Sorry, I could not process that file: ${message}`);
    }
  }

  // ─── Text message handler ─────────────────────────────────────────────────

  @On('text')
  async onMessage(
    @Ctx() ctx: Context,
    @Message('text') text: string,
  ) {
    const user = ctx.from;
    if (!user) return;
    if (ctx.chat?.type !== 'private') return; // groups handled by GroupUpdate

    const telegramId = String(user.id);
    const userMessage = text.trim();

    // --- Check for pending permission reply ---
    const pendingScope = await this.shortTerm.getPendingPermission(telegramId);
    if (pendingScope) {
      await this.handlePermissionReply(ctx, telegramId, pendingScope, userMessage);
      return;
    }

    // --- Rate limit ---
    if (!(await this.shortTerm.checkRateLimit(telegramId, this.rateLimitMax()))) {
      await ctx.reply('Please slow down — you\'ve sent too many messages. Try again in a moment.');
      return;
    }

    // --- Typing indicator ---
    await ctx.sendChatAction('typing');

    // --- Build context and call AI ---
    const contextMessages = await this.memory.buildContextWindow(telegramId);

    let reply: string;
    try {
      reply = await this.ai.sendMessage(userMessage, contextMessages);
    } catch (error) {
      this.logger.error('AI call failed', error);
      await ctx.reply('Sorry, I ran into an issue processing your request. Please try again.');
      return;
    }

    // --- Check if AI flagged a permission requirement ---
    const requiredScope = this.ai.extractPermissionRequest(reply);
    if (requiredScope) {
      const scope = requiredScope as PermissionScope;
      const isValid = Object.values(PermissionScope).includes(scope);
      if (isValid) {
        const alreadyGranted = await this.permissions.checkPermission(telegramId, scope);
        if (!alreadyGranted) {
          await this.shortTerm.setPendingPermission(telegramId, scope);
          const requestMsg = this.permissions.buildRequestMessage(scope);
          await ctx.reply(requestMsg, { parse_mode: 'Markdown' });
          return;
        }
      }
    }

    // --- Save exchange to memory + auto-summarise if session is long ---
    await this.memory.saveExchange(telegramId, userMessage, reply);
    await this.memory.autoSummariseIfNeeded(telegramId);

    // --- Send reply (split if over Telegram's 4096 char limit) ---
    await this.sendLongMessage(ctx, reply);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private rateLimitMax(): number {
    const envVal = process.env.RATE_LIMIT_PER_MINUTE;
    return envVal ? parseInt(envVal, 10) : 20;
  }

  private async handlePermissionReply(
    ctx: Context,
    telegramId: string,
    scope: string,
    userMessage: string,
  ): Promise<void> {
    const answer = userMessage.toLowerCase();
    const isYes = ['yes', 'y', 'ok', 'sure', 'allow', 'grant'].some((w) =>
      answer.includes(w),
    );
    const isNo = ['no', 'n', 'deny', 'decline', 'reject', 'nope'].some((w) =>
      answer.includes(w),
    );

    await this.shortTerm.clearPendingPermission(telegramId);

    if (isYes) {
      await this.permissions.grantPermission(telegramId, scope as PermissionScope);
      await ctx.reply(
        `Permission granted ✅ I can now ${scope.toLowerCase().replace(/_/g, ' ')}.\n\nYou can revoke this at any time with /permissions.`,
      );
    } else if (isNo) {
      await ctx.reply(
        `Understood, permission declined. I won't perform that action.\n\nYou can change this at any time with /permissions.`,
      );
    } else {
      await this.shortTerm.setPendingPermission(telegramId, scope);
      await ctx.reply('Please reply with *yes* to allow or *no* to decline.', {
        parse_mode: 'Markdown',
      });
    }
  }

  /** Splits messages longer than Telegram's 4096 character limit */
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
