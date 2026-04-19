import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ShortTermService } from './short-term.service';
import { LongTermService } from './long-term.service';
import { StoredMessage } from '../database/entities/conversation.entity';
import { AIService } from '../ai/ai.service';

export interface ContextMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SUMMARISE_THRESHOLD = 30; // messages in Redis session before summarising
const KEEP_AFTER_SUMMARISE = 5; // messages to retain in Redis after summarisation

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);

  constructor(
    private readonly shortTerm: ShortTermService,
    private readonly longTerm: LongTermService,
    @Inject(forwardRef(() => AIService))
    private readonly ai: AIService,
  ) {}

  /**
   * Builds an ordered message array ready to pass to the AI.
   * Priority: long-term summary (as context prefix) + Redis session (recent turns).
   */
  async buildContextWindow(telegramId: string): Promise<ContextMessage[]> {
    const [sessionMessages, conversation] = await Promise.all([
      this.shortTerm.getSession(telegramId),
      this.longTerm.getConversation(telegramId),
    ]);

    const context: ContextMessage[] = [];

    if (conversation?.summary) {
      // Inject the summary as a system-style assistant note so the AI knows prior context
      context.push({
        role: 'user',
        content: `[Context from previous sessions]: ${conversation.summary}`,
      });
      context.push({
        role: 'assistant',
        content: 'Understood. I have your prior context loaded and will continue from there.',
      });
    }

    for (const msg of sessionMessages) {
      context.push({ role: msg.role, content: msg.content });
    }

    return context;
  }

  async saveExchange(
    telegramId: string,
    userMessage: string,
    assistantReply: string,
  ): Promise<void> {
    const now = new Date().toISOString();
    const userMsg: StoredMessage = { role: 'user', content: userMessage, timestamp: now };
    const assistantMsg: StoredMessage = {
      role: 'assistant',
      content: assistantReply,
      timestamp: now,
    };

    await Promise.all([
      this.shortTerm.saveMessage(telegramId, userMsg),
      this.shortTerm.saveMessage(telegramId, assistantMsg),
      this.longTerm.appendMessages(telegramId, [userMsg, assistantMsg]),
    ]);
  }

  /**
   * If the Redis session has reached the summarisation threshold, call Claude to
   * produce a summary, persist it to Postgres, and reset the session to only
   * the most recent messages. This keeps token costs low and long-term memory useful.
   */
  async autoSummariseIfNeeded(telegramId: string): Promise<void> {
    const session = await this.shortTerm.getSession(telegramId);
    if (session.length < SUMMARISE_THRESHOLD) return;

    try {
      this.logger.log(`Auto-summarising session for ${telegramId} (${session.length} messages)`);

      const contextMessages: ContextMessage[] = session.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const newSummary = await this.ai.summariseConversation(contextMessages);

      // Append to any existing summary
      const existing = await this.longTerm.getConversation(telegramId);
      const combined = existing?.summary
        ? `${existing.summary}\n\n[Later]: ${newSummary}`
        : newSummary;

      await this.longTerm.saveConversationSummary(telegramId, combined);

      // Keep only the tail of the session in Redis
      const tail = session.slice(-KEEP_AFTER_SUMMARISE);
      await this.shortTerm.setSession(telegramId, tail);

      this.logger.log(`Session summarised and reset for ${telegramId}`);
    } catch (err) {
      // Non-fatal — log and continue; the session stays as-is
      this.logger.error('Auto-summarisation failed', err);
    }
  }
}
