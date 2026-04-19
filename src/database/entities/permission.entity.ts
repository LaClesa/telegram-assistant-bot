import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum PermissionScope {
  GROUP_ACCESS = 'GROUP_ACCESS',
  MESSAGING = 'MESSAGING',
  FILE_ACCESS = 'FILE_ACCESS',
  API_ACCESS = 'API_ACCESS',
  DOCUMENT_MODIFY = 'DOCUMENT_MODIFY',
  RUN_CODE = 'RUN_CODE',
  LONG_TERM_MEMORY = 'LONG_TERM_MEMORY',
}

@Entity('permissions')
export class PermissionEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  telegramId: string;

  @Column({ type: 'varchar' })
  scope: PermissionScope;

  @Column({ default: false })
  granted: boolean;

  @Column({ nullable: true, type: 'timestamptz' })
  grantedAt: Date | null;

  @Column({ nullable: true, type: 'timestamptz' })
  revokedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
