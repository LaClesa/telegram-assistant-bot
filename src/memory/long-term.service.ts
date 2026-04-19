import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../database/entities/user.entity';
import {
  ConversationEntity,
  StoredMessage,
} from '../database/entities/conversation.entity';

const MAX_STORED_MESSAGES = 100;

@Injectable()
export class LongTermService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,

    @InjectRepository(ConversationEntity)
    private readonly conversationRepo: Repository<ConversationEntity>,
  ) {}

  async upsertUser(
    telegramId: string,
    username?: string,
    firstName?: string,
  ): Promise<UserEntity> {
    let user = await this.userRepo.findOne({ where: { telegramId } });
    if (!user) {
      user = this.userRepo.create({ telegramId, username, firstName });
    } else {
      if (username) user.username = username;
      if (firstName) user.firstName = firstName;
    }
    return this.userRepo.save(user);
  }

  async getUser(telegramId: string): Promise<UserEntity | null> {
    return this.userRepo.findOne({ where: { telegramId } });
  }

  async updatePreferences(
    telegramId: string,
    patch: Record<string, unknown>,
  ): Promise<void> {
    const user = await this.upsertUser(telegramId);
    user.preferences = { ...user.preferences, ...patch };
    await this.userRepo.save(user);
  }

  async getUserPreferences(telegramId: string): Promise<Record<string, unknown>> {
    const user = await this.userRepo.findOne({ where: { telegramId } });
    return user?.preferences ?? {};
  }

  async appendMessages(telegramId: string, messages: StoredMessage[]): Promise<void> {
    let conv = await this.conversationRepo.findOne({ where: { telegramId } });
    if (!conv) {
      conv = this.conversationRepo.create({ telegramId, messages: [] });
    }
    conv.messages = [...conv.messages, ...messages].slice(-MAX_STORED_MESSAGES);
    await this.conversationRepo.save(conv);
  }

  async getConversation(telegramId: string): Promise<ConversationEntity | null> {
    return this.conversationRepo.findOne({ where: { telegramId } });
  }

  async saveConversationSummary(telegramId: string, summary: string): Promise<void> {
    let conv = await this.conversationRepo.findOne({ where: { telegramId } });
    if (!conv) {
      conv = this.conversationRepo.create({ telegramId, messages: [] });
    }
    conv.summary = summary;
    await this.conversationRepo.save(conv);
  }
}
