import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { MemoryModule } from '../memory/memory.module';

@Module({
  imports: [MemoryModule],
  controllers: [HealthController],
})
export class HealthModule {}
