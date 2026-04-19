import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('google_credentials')
export class GoogleCredentialEntity {
  @PrimaryGeneratedColumn()
  id: number;

  /** One credential record per Telegram user */
  @Column({ unique: true })
  telegramId: string;

  /** AES-256-GCM encrypted access token (format: iv_hex:ciphertext_hex) */
  @Column({ type: 'text' })
  encryptedAccessToken: string;

  /** AES-256-GCM encrypted refresh token */
  @Column({ type: 'text', nullable: true })
  encryptedRefreshToken: string | null;

  /** When the access token expires */
  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  /** Google account email address */
  @Column({ nullable: true })
  email: string | null;

  /** OAuth scopes granted */
  @Column({ type: 'text', nullable: true })
  scope: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
