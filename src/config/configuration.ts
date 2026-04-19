export default () => ({
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY ?? '',
  },
  database: {
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/telegram_bot',
  },
  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  },
  nodeEnv: process.env.NODE_ENV ?? 'development',
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    callbackUrl: process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:3000/auth/google/callback',
  },
  tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY ?? '',
  webhookUrl: process.env.WEBHOOK_URL ?? '',
  rateLimitPerMinute: parseInt(process.env.RATE_LIMIT_PER_MINUTE ?? '20', 10),
});
