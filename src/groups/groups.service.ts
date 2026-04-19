import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Context } from 'telegraf';
import { GroupSettingsEntity } from './entities/group-settings.entity';

@Injectable()
export class GroupsService {
  private readonly logger = new Logger(GroupsService.name);

  constructor(
    @InjectRepository(GroupSettingsEntity)
    private readonly groupRepo: Repository<GroupSettingsEntity>,
  ) {}

  async getSettings(chatId: string): Promise<GroupSettingsEntity | null> {
    return this.groupRepo.findOne({ where: { chatId } });
  }

  /** Returns true if bot should respond in this group (defaults to true for unknown groups) */
  async isEnabled(chatId: string): Promise<boolean> {
    const settings = await this.getSettings(chatId);
    return settings?.botEnabled ?? true;
  }

  async upsertSettings(
    chatId: string,
    groupTitle: string | null,
    addedById: string | null,
  ): Promise<void> {
    let settings = await this.getSettings(chatId);
    if (!settings) {
      settings = this.groupRepo.create({ chatId, groupTitle, addedById, botEnabled: true });
    } else {
      if (groupTitle) settings.groupTitle = groupTitle;
    }
    await this.groupRepo.save(settings);
  }

  async setEnabled(chatId: string, enabled: boolean): Promise<void> {
    let settings = await this.getSettings(chatId);
    if (!settings) {
      settings = this.groupRepo.create({ chatId, botEnabled: enabled });
    } else {
      settings.botEnabled = enabled;
    }
    await this.groupRepo.save(settings);
    this.logger.log(`Group ${chatId} bot ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Returns true if the given user is a group admin or creator.
   * Uses Telegram's getChatMember API — no custom tables needed.
   */
  async isAdmin(ctx: Context, chatId: string, userId: string): Promise<boolean> {
    try {
      const member = await ctx.telegram.getChatMember(chatId, parseInt(userId, 10));
      return member.status === 'administrator' || member.status === 'creator';
    } catch (err) {
      this.logger.warn(`getChatMember failed for chatId=${chatId} userId=${userId}`, err);
      return false;
    }
  }
}
