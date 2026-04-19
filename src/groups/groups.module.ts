import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroupSettingsEntity } from './entities/group-settings.entity';
import { GroupsService } from './groups.service';

@Module({
  imports: [TypeOrmModule.forFeature([GroupSettingsEntity])],
  providers: [GroupsService],
  exports: [GroupsService],
})
export class GroupsModule {}
