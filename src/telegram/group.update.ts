import { Logger } from '@nestjs/common';
import { Update, On, Command, Ctx, Message } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { AIService } from '../ai/ai.service';
import { MemoryService } from '../memory/memory.service';
import { ShortTermService } from '../memory/short-term.service';
import { GroupsService } from '../groups/groups.service';

const GROUP_RATE_LIMIT = 30; // messages per minute across the whole group
const MAX_REPLY_LENGTH = 4096;

@Update()
export class GroupUpdate {
  private readonly logger = new Logger(GroupUpdate.name);

  constructor(
    private readonly ai: AIService,
    private readonly memory: MemoryService,
    private readonly shortTerm: ShortTermService,
    private readonly groups: GroupsService,
  ) {}

  // ─── Bot added to / removed from group ───────────────────────────────────

  @On('my_chat_member')
  async onMyChatMember(@Ctx() ctx: Context) {
    const update = ctx.update as {
      my_chat_member?: {
        chat: { id: number; title?: string; type: string };
        from: { id: number };
        new_chat_member: { status: string };
      };
    };
    const event = update.my_chat_member;
    if (!event) return;

    const chatType = event.chat.type;
    if (chatType !== 'group' && chatType !== 'supergroup') return;

    const chatId = String(event.chat.id);
    const title = event.chat.title ?? null;
    const addedById = String(event.from.id);
    const newStatus = event.new_chat_member.status;

    if (newStatus === 'member' || newStatus === 'administrator') {
      await this.groups.upsertSettings(chatId, title, addedById);
      this.logger.log(`Bot added to group ${chatId} ("${title ?? 'unknown'}")`);
    }
  }

  // ─── Group text message handler ───────────────────────────────────────────

  @On('text')
  async onGroupMessage(
    @Ctx() ctx: Context,
    @Message('text') text: string,
  ) {
    // Only handle group/supergroup chats
    const chatType = ctx.chat?.type;
    if (chatType !== 'group' && chatType !== 'supergroup') return;

    const user = ctx.from;
    if (!user) return;

    const chatId = String(ctx.chat!.id);
    const chatTitle = ('title' in ctx.chat! ? ctx.chat.title : null) ?? 'Group';
    const senderName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || 'User';
    const botUsername = ctx.botInfo.username;

    // ── Is bot enabled in this group? ────────────────────────────────────
    if (!(await this.groups.isEnabled(chatId))) return;

    // ── @mention or reply-to-bot detection ───────────────────────────────
    const isMentioned = text.includes(`@${botUsername}`);
    const message = ctx.message as {
      reply_to_message?: { from?: { username?: string; is_bot?: boolean } };
    };
    const isReplyToBot =
      message.reply_to_message?.from?.is_bot === true &&
      message.reply_to_message?.from?.username === botUsername;

    if (!isMentioned && !isReplyToBot) return;

    // ── Rate limit per group ──────────────────────────────────────────────
    const groupRateKey = `group:${chatId}`;
    if (!(await this.shortTerm.checkRateLimit(groupRateKey, GROUP_RATE_LIMIT))) {
      await ctx.reply('Too many messages — please slow down. I\'ll be back in a moment.');
      return;
    }

    await ctx.sendChatAction('typing');

    // ── Strip @mention from the text before sending to AI ─────────────────
    const cleanedText = text.replace(new RegExp(`@${botUsername}`, 'gi'), '').trim();
    const attributedMessage = `[${senderName}]: ${cleanedText || '(said nothing after mention)'}`;

    // ── Build group context window ────────────────────────────────────────
    const contextMessages = await this.memory.buildContextWindow(groupRateKey);

    // ── Prepend group preamble ────────────────────────────────────────────
    const groupPreamble =
      `[Group chat: "${chatTitle}" — multiple users are talking. ` +
      `Messages are prefixed with the sender's name in [brackets]. ` +
      `Be concise and refer to users by their first name when relevant. ` +
      `Do not request permissions here — tell the user to message you privately instead.]`;

    const promptWithPreamble = `${groupPreamble}\n\n${attributedMessage}`;

    // ── Call AI ───────────────────────────────────────────────────────────
    let reply: string;
    try {
      reply = await this.ai.sendMessage(promptWithPreamble, contextMessages);
    } catch (err) {
      this.logger.error('AI call failed in group', err);
      await ctx.reply('Sorry, I ran into an issue. Please try again.');
      return;
    }

    // Strip any permission request signals — not valid in group context
    reply = reply.replace(/\[PERMISSION_REQUIRED:[^\]]*\]/gi, '').trim();
    if (!reply) reply = 'I need you to message me privately for that request.';

    // ── Save exchange + auto-summarise ────────────────────────────────────
    await this.memory.saveExchange(groupRateKey, attributedMessage, reply);
    await this.memory.autoSummariseIfNeeded(groupRateKey);

    // ── Reply ─────────────────────────────────────────────────────────────
    await this.sendGroupReply(ctx, reply);
  }

  // ─── Admin commands ───────────────────────────────────────────────────────

  @Command('enable')
  async onEnable(@Ctx() ctx: Context) {
    if (!this.isGroupChat(ctx)) return;
    const chatId = String(ctx.chat!.id);
    const userId = String(ctx.from?.id);

    if (!(await this.groups.isAdmin(ctx, chatId, userId))) {
      await ctx.reply('Only group admins can use this command.');
      return;
    }

    await this.groups.setEnabled(chatId, true);
    await ctx.reply('✅ Bot enabled in this group. I\'ll respond when @mentioned.');
  }

  @Command('disable')
  async onDisable(@Ctx() ctx: Context) {
    if (!this.isGroupChat(ctx)) return;
    const chatId = String(ctx.chat!.id);
    const userId = String(ctx.from?.id);

    if (!(await this.groups.isAdmin(ctx, chatId, userId))) {
      await ctx.reply('Only group admins can use this command.');
      return;
    }

    await this.groups.setEnabled(chatId, false);
    await ctx.reply('🔇 Bot disabled in this group. Use /enable to re-activate.');
  }

  @Command('groupsettings')
  async onGroupSettings(@Ctx() ctx: Context) {
    if (!this.isGroupChat(ctx)) return;
    const chatId = String(ctx.chat!.id);

    const settings = await this.groups.getSettings(chatId);
    const enabled = settings?.botEnabled ?? true;
    const title = settings?.groupTitle ?? 'Unknown';
    const session = await this.shortTerm.getSession(`group:${chatId}`);

    await ctx.reply(
      `*Group bot settings*\n\n` +
        `Group: ${title}\n` +
        `Status: ${enabled ? '✅ Enabled' : '🔇 Disabled'}\n` +
        `Session messages: ${session.length}\n\n` +
        `_Admins can use /enable or /disable to control the bot._`,
      { parse_mode: 'Markdown' },
    );
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private isGroupChat(ctx: Context): boolean {
    const type = ctx.chat?.type;
    return type === 'group' || type === 'supergroup';
  }

  private async sendGroupReply(ctx: Context, text: string): Promise<void> {
    if (text.length <= MAX_REPLY_LENGTH) {
      await ctx.reply(text);
      return;
    }
    for (let i = 0; i < text.length; i += MAX_REPLY_LENGTH) {
      await ctx.reply(text.slice(i, i + MAX_REPLY_LENGTH));
    }
  }
}
