import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TelegrafModule } from 'nestjs-telegraf';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { MemoryModule } from './memory/memory.module';
import { PermissionsModule } from './permissions/permissions.module';
import { AIModule } from './ai/ai.module';
import { FilesModule } from './files/files.module';
import { GoogleModule } from './google/google.module';
import { GroupsModule } from './groups/groups.module';
import { HealthModule } from './health/health.module';
import { TelegramModule } from './telegram/telegram.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
    }),
    TelegrafModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const webhookUrl = config.get<string>('webhookUrl');
        return {
          token: config.get<string>('telegram.botToken') ?? '',
          ...(webhookUrl
            ? {
                launchOptions: {
                  webhook: {
                    domain: webhookUrl,
                    path: '/telegram-webhook',
                  },
                },
              }
            : {}),
        };
      },
    }),
    DatabaseModule,
    MemoryModule,
    PermissionsModule,
    AIModule,
    FilesModule,
    GoogleModule,
    GroupsModule,
    HealthModule,
    TelegramModule,
  ],
})
export class AppModule {}
