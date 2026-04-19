import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { StoredMessage } from '../database/entities/conversation.entity';

const SESSION_TTL_SECONDS = 2 * 60 * 60; // 2 hours
const MAX_SESSION_MESSAGES = 50;

@Injectable()
export class ShortTermService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.client = new Redis(this.config.get<string>('redis.url') ?? 'redis://localhost:6379');
  }

  onModuleDestroy() {
    void this.client.quit();
  }

  private sessionKey(telegramId: string): string {
    return `session:${telegramId}`;
  }

  private pendingPermissionKey(telegramId: string): string {
    return `pending_permission:${telegramId}`;
  }

  async getSession(telegramId: string): Promise<StoredMessage[]> {
    const raw = await this.client.get(this.sessionKey(telegramId));
    if (!raw) return [];
    return JSON.parse(raw) as StoredMessage[];
  }

  async saveMessage(telegramId: string, message: StoredMessage): Promise<void> {
    const messages = await this.getSession(telegramId);
    messages.push(message);

    // Keep only the most recent messages to avoid unbounded growth
    const trimmed = messages.slice(-MAX_SESSION_MESSAGES);
    await this.client.set(
      this.sessionKey(telegramId),
      JSON.stringify(trimmed),
      'EX',
      SESSION_TTL_SECONDS,
    );
  }

  async clearSession(telegramId: string): Promise<void> {
    await this.client.del(this.sessionKey(telegramId));
  }

  /** Store a pending permission request so the reply handler can resolve it */
  async setPendingPermission(telegramId: string, scope: string): Promise<void> {
    await this.client.set(this.pendingPermissionKey(telegramId), scope, 'EX', 300); // 5 min TTL
  }

  async getPendingPermission(telegramId: string): Promise<string | null> {
    return this.client.get(this.pendingPermissionKey(telegramId));
  }

  async clearPendingPermission(telegramId: string): Promise<void> {
    await this.client.del(this.pendingPermissionKey(telegramId));
  }

  // ─── OAuth state helpers ──────────────────────────────────────────────────

  private oauthStateKey(state: string): string {
    return `oauth_state:${state}`;
  }

  /** Store state → telegramId mapping during OAuth flow (10 min TTL) */
  async setOAuthState(state: string, telegramId: string): Promise<void> {
    await this.client.set(this.oauthStateKey(state), telegramId, 'EX', 600);
  }

  async getOAuthState(state: string): Promise<string | null> {
    return this.client.get(this.oauthStateKey(state));
  }

  async clearOAuthState(state: string): Promise<void> {
    await this.client.del(this.oauthStateKey(state));
  }

  // ─── Rate limiting ────────────────────────────────────────────────────────

  private rateLimitKey(telegramId: string): string {
    return `rate_limit:${telegramId}`;
  }

  /**
   * Increments the per-user request counter for a 60-second sliding window.
   * Returns true if the user is within the allowed limit, false if exceeded.
   */
  async checkRateLimit(telegramId: string, maxPerMinute: number): Promise<boolean> {
    const key = this.rateLimitKey(telegramId);
    const count = await this.client.incr(key);
    if (count === 1) {
      // First request in this window — set expiry
      await this.client.expire(key, 60);
    }
    return count <= maxPerMinute;
  }

  // ─── Session helpers for summarisation ───────────────────────────────────

  /** Overwrite the session with a trimmed set of messages (used after summarisation) */
  async setSession(telegramId: string, messages: StoredMessage[]): Promise<void> {
    await this.client.set(
      this.sessionKey(telegramId),
      JSON.stringify(messages),
      'EX',
      SESSION_TTL_SECONDS,
    );
  }

  /** Expose Redis client PING for health checks */
  async ping(): Promise<string> {
    return this.client.ping();
  }
}
