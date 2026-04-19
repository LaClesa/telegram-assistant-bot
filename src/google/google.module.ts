import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GoogleCredentialEntity } from './entities/google-credential.entity';
import { GoogleAuthService } from './google-auth.service';
import { GoogleAuthController } from './google-auth.controller';
import { GoogleDocsService } from './google-docs.service';
import { GoogleSheetsService } from './google-sheets.service';
import { GoogleDriveService } from './google-drive.service';
import { MemoryModule } from '../memory/memory.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([GoogleCredentialEntity]),
    MemoryModule,
  ],
  controllers: [GoogleAuthController],
  providers: [
    GoogleAuthService,
    GoogleDocsService,
    GoogleSheetsService,
    GoogleDriveService,
  ],
  exports: [
    GoogleAuthService,
    GoogleDocsService,
    GoogleSheetsService,
    GoogleDriveService,
  ],
})
export class GoogleModule {}
