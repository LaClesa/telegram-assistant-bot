import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('group_settings')
export class GroupSettingsEntity {
  @PrimaryGeneratedColumn()
  id: number;

  /** Telegram chat ID (negative number for groups, stored as string) */
  @Column({ unique: true })
  chatId: string;

  /** Group title at the time the bot was added */
  @Column({ nullable: true })
  groupTitle: string | null;

  /** Whether the bot actively responds in this group */
  @Column({ default: true })
  botEnabled: boolean;

  /** Telegram user ID of the person who added the bot */
  @Column({ nullable: true })
  addedById: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
