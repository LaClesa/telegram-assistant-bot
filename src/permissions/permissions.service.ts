import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PermissionEntity,
  PermissionScope,
} from '../database/entities/permission.entity';

const SCOPE_DESCRIPTIONS: Record<PermissionScope, string> = {
  [PermissionScope.GROUP_ACCESS]: 'access group chats',
  [PermissionScope.MESSAGING]: 'send messages to other users on your behalf',
  [PermissionScope.FILE_ACCESS]: 'access local or cloud files',
  [PermissionScope.API_ACCESS]: 'connect to external APIs or services',
  [PermissionScope.DOCUMENT_MODIFY]: 'edit documents (Google Docs, Sheets, etc.)',
  [PermissionScope.RUN_CODE]: 'run code or scripts',
  [PermissionScope.LONG_TERM_MEMORY]: 'store information in long-term memory',
};

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(PermissionEntity)
    private readonly permissionRepo: Repository<PermissionEntity>,
  ) {}

  async checkPermission(telegramId: string, scope: PermissionScope): Promise<boolean> {
    const record = await this.permissionRepo.findOne({
      where: { telegramId, scope },
    });
    return record?.granted ?? false;
  }

  async grantPermission(telegramId: string, scope: PermissionScope): Promise<void> {
    let record = await this.permissionRepo.findOne({ where: { telegramId, scope } });
    if (!record) {
      record = this.permissionRepo.create({ telegramId, scope });
    }
    record.granted = true;
    record.grantedAt = new Date();
    record.revokedAt = null;
    await this.permissionRepo.save(record);
  }

  async revokePermission(telegramId: string, scope: PermissionScope): Promise<void> {
    const record = await this.permissionRepo.findOne({ where: { telegramId, scope } });
    if (record) {
      record.granted = false;
      record.revokedAt = new Date();
      await this.permissionRepo.save(record);
    }
  }

  async getAllPermissions(
    telegramId: string,
  ): Promise<Array<{ scope: PermissionScope; granted: boolean }>> {
    const records = await this.permissionRepo.find({ where: { telegramId } });
    const recordMap = new Map(records.map((r) => [r.scope, r.granted]));

    return Object.values(PermissionScope).map((scope) => ({
      scope,
      granted: recordMap.get(scope) ?? false,
    }));
  }

  /** Returns a human-readable consent request message for the user */
  buildRequestMessage(scope: PermissionScope): string {
    const description = SCOPE_DESCRIPTIONS[scope];
    return (
      `I need your permission to **${description}**.\n\n` +
      `Reply **yes** to allow or **no** to decline.\n\n` +
      `You can revoke this at any time with /permissions.`
    );
  }

  /** Formats the full permissions list as a readable Telegram message */
  async buildPermissionsSummary(telegramId: string): Promise<string> {
    const all = await this.getAllPermissions(telegramId);
    const lines = all.map(({ scope, granted }) => {
      const icon = granted ? '✅' : '❌';
      return `${icon} ${SCOPE_DESCRIPTIONS[scope]}`;
    });
    return `*Your current permissions:*\n\n${lines.join('\n')}`;
  }
}
