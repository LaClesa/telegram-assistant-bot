import { Controller, Get, Query, Res, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { GoogleAuthService } from './google-auth.service';

@Controller('auth/google')
export class GoogleAuthController {
  private readonly logger = new Logger(GoogleAuthController.name);

  constructor(private readonly googleAuth: GoogleAuthService) {}

  @Get('callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    if (error) {
      this.logger.warn(`OAuth error from Google: ${error}`);
      return res.status(400).send(`
        <html><body style="font-family:sans-serif;text-align:center;padding:40px">
          <h2>❌ Authorization denied</h2>
          <p>You declined the Google authorization. You can try again in Telegram with /connect.</p>
        </body></html>
      `);
    }

    if (!code || !state) {
      return res.status(400).send('Missing code or state parameter.');
    }

    try {
      await this.googleAuth.exchangeCode(code, state);
      return res.status(200).send(`
        <html><body style="font-family:sans-serif;text-align:center;padding:40px">
          <h2>✅ Google account connected!</h2>
          <p>You can close this tab and return to Telegram.</p>
        </body></html>
      `);
    } catch (err) {
      this.logger.error('OAuth callback failed', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      return res.status(500).send(`
        <html><body style="font-family:sans-serif;text-align:center;padding:40px">
          <h2>❌ Connection failed</h2>
          <p>${message}</p>
        </body></html>
      `);
    }
  }
}
