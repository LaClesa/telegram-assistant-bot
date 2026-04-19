import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  const webhookUrl = process.env.WEBHOOK_URL;
  if (webhookUrl) {
    logger.log(`Telegram bot running in webhook mode → ${webhookUrl}/telegram-webhook`);
  } else {
    logger.log('Telegram bot running in long-polling mode (dev)');
  }

  logger.log(`HTTP server listening on port ${port}`);
}

bootstrap();
