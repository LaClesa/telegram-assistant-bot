import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../database/entities/user.entity';
import { ConversationEntity } from '../database/entities/conversation.entity';
import { ShortTermService } from './short-term.service';
import { LongTermService } from './long-term.service';
import { MemoryService } from './memory.service';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, ConversationEntity]),
    forwardRef(() => AIModule),
  ],
  providers: [ShortTermService, LongTermService, MemoryService],
  exports: [ShortTermService, LongTermService, MemoryService],
})
export class MemoryModule {}
