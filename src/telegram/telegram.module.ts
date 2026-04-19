import { Module } from '@nestjs/common';
import { TelegramUpdate } from './telegram.update';
import { GoogleUpdate } from './google.update';
import { GroupUpdate } from './group.update';
import { AIModule } from '../ai/ai.module';
import { MemoryModule } from '../memory/memory.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { FilesModule } from '../files/files.module';
import { GoogleModule } from '../google/google.module';
import { GroupsModule } from '../groups/groups.module';

@Module({
  imports: [AIModule, MemoryModule, PermissionsModule, FilesModule, GoogleModule, GroupsModule],
  providers: [TelegramUpdate, GoogleUpdate, GroupUpdate],
})
export class TelegramModule {}
