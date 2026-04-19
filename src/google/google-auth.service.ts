import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { google, Auth } from 'googleapis';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { GoogleCredentialEntity } from './entities/google-credential.entity';
import { ShortTermService } from '../memory/short-term.service';

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/userinfo.email',
];

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly shortTerm: ShortTermService,
    @InjectRepository(GoogleCredentialEntity)
    private readonly credRepo: Repository<GoogleCredentialEntity>,
    @InjectBot() private readonly bot: Telegraf,
  ) {}

  // ─── OAuth client factory ─────────────────────────────────────────────────

  private createOAuth2Client(): Auth.OAuth2Client {
    return new google.auth.OAuth2(
      this.config.get<string>('google.clientId'),
      this.config.get<string>('google.clientSecret'),
      this.config.get<string>('google.callbackUrl'),
    );
  }

  // ─── Auth URL generation ──────────────────────────────────────────────────

  async getAuthUrl(telegramId: string): Promise<string> {
    const state = randomBytes(32).toString('hex');
    await this.shortTerm.setOAuthState(state, telegramId);

    const client = this.createOAuth2Client();
    return client.generateAuthUrl({
      access_type: 'offline',
      scope: GOOGLE_SCOPES,
      state,
      prompt: 'consent', // force refresh_token to be returned every time
    });
  }

  // ─── Code exchange (called from HTTP controller) ──────────────────────────

  async exchangeCode(code: string, state: string): Promise<void> {
    const telegramId = await this.shortTerm.getOAuthState(state);
    if (!telegramId) {
      throw new Error('OAuth state not found or expired. Please start the connection again.');
    }
    await this.shortTerm.clearOAuthState(state);

    const client = this.createOAuth2Client();
    const { tokens } = await client.getToken(code);

    if (!tokens.access_token) throw new Error('No access token in Google response');

    // Fetch user email for display
    client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const { data: userInfo } = await oauth2.userinfo.get();

    // Persist encrypted tokens
    await this.storeCredentials(telegramId, tokens, userInfo.email ?? null);

    // Notify user in Telegram
    await this.bot.telegram.sendMessage(
      telegramId,
      `✅ *Google account connected!*\n\nEmail: ${userInfo.email ?? 'unknown'}\n\nYou can now use /gdoc, /gsheet, and /gdrive commands.`,
      { parse_mode: 'Markdown' },
    );

    this.logger.log(`Google account connected for telegramId=${telegramId}`);
  }

  // ─── Authenticated client for API calls ──────────────────────────────────

  async getClient(telegramId: string): Promise<Auth.OAuth2Client> {
    const cred = await this.credRepo.findOne({ where: { telegramId } });
    if (!cred) {
      throw new Error(
        'Google account not connected. Use /connect to link your Google account.',
      );
    }

    const client = this.createOAuth2Client();
    const accessToken = this.decrypt(cred.encryptedAccessToken);
    const refreshToken = cred.encryptedRefreshToken
      ? this.decrypt(cred.encryptedRefreshToken)
      : undefined;

    client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
      expiry_date: cred.expiresAt?.getTime(),
    });

    // Auto-refresh: if expired or within 5 minutes of expiry, refresh now
    const expiryBuffer = 5 * 60 * 1000;
    const isExpired =
      !cred.expiresAt || cred.expiresAt.getTime() - Date.now() < expiryBuffer;

    if (isExpired && refreshToken) {
      const { credentials } = await client.refreshAccessToken();
      await this.storeCredentials(telegramId, credentials, cred.email);
      client.setCredentials(credentials);
    }

    return client;
  }

  async isConnected(telegramId: string): Promise<boolean> {
    const cred = await this.credRepo.findOne({ where: { telegramId } });
    return !!cred;
  }

  async getConnectedEmail(telegramId: string): Promise<string | null> {
    const cred = await this.credRepo.findOne({ where: { telegramId } });
    return cred?.email ?? null;
  }

  // ─── Revoke & disconnect ──────────────────────────────────────────────────

  async revokeTokens(telegramId: string): Promise<void> {
    const cred = await this.credRepo.findOne({ where: { telegramId } });
    if (!cred) return;

    try {
      const client = this.createOAuth2Client();
      const accessToken = this.decrypt(cred.encryptedAccessToken);
      await client.revokeToken(accessToken);
    } catch (err) {
      this.logger.warn(`Token revocation at Google failed (may already be expired)`, err);
    }

    await this.credRepo.delete({ telegramId });
    this.logger.log(`Google credentials deleted for telegramId=${telegramId}`);
  }

  // ─── Token persistence ────────────────────────────────────────────────────

  private async storeCredentials(
    telegramId: string,
    tokens: Auth.Credentials,
    email: string | null,
  ): Promise<void> {
    let cred = await this.credRepo.findOne({ where: { telegramId } });
    if (!cred) {
      cred = this.credRepo.create({ telegramId });
    }

    cred.encryptedAccessToken = this.encrypt(tokens.access_token!);
    if (tokens.refresh_token) {
      cred.encryptedRefreshToken = this.encrypt(tokens.refresh_token);
    }
    cred.expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : null;
    cred.email = email;
    cred.scope = tokens.scope ?? null;

    await this.credRepo.save(cred);
  }

  // ─── Encryption helpers (AES-256-GCM) ────────────────────────────────────

  private getEncryptionKey(): Buffer {
    const hex = this.config.get<string>('tokenEncryptionKey') ?? '';
    if (hex.length !== 64) {
      throw new Error(
        'TOKEN_ENCRYPTION_KEY must be 64 hex characters (32 bytes). Generate with: openssl rand -hex 32',
      );
    }
    return Buffer.from(hex, 'hex');
  }

  private encrypt(plaintext: string): string {
    const key = this.getEncryptionKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    // Format: iv_hex:authTag_hex:ciphertext_hex
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  private decrypt(stored: string): string {
    const parts = stored.split(':');
    if (parts.length !== 3) throw new Error('Invalid encrypted token format');
    const [ivHex, authTagHex, ciphertextHex] = parts;
    const key = this.getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const ciphertext = Buffer.from(ciphertextHex, 'hex');
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8');
  }
}
