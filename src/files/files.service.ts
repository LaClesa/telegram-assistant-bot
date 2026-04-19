import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // Telegram's 20 MB bot limit
const WARN_SIZE_BYTES = 5 * 1024 * 1024; // warn user above 5 MB for heavy extraction

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Downloads a file from Telegram by its file_id.
   * Returns the raw Buffer and the file's size in bytes.
   */
  async downloadFile(fileId: string): Promise<{ buffer: Buffer; size: number; filePath: string }> {
    const token = this.config.get<string>('telegram.botToken') ?? '';

    // Step 1: resolve file_id → file_path
    const metaRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
    if (!metaRes.ok) {
      throw new Error(`Telegram getFile failed: ${metaRes.status}`);
    }
    const meta = (await metaRes.json()) as {
      ok: boolean;
      result: { file_path: string; file_size?: number };
    };
    if (!meta.ok) throw new Error('Telegram getFile returned ok=false');

    const filePath = meta.result.file_path;
    const size = meta.result.file_size ?? 0;

    if (size > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File too large (${(size / 1024 / 1024).toFixed(1)} MB). Max is 20 MB.`);
    }

    // Step 2: download the actual bytes
    const downloadUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;
    const fileRes = await fetch(downloadUrl);
    if (!fileRes.ok) {
      throw new Error(`File download failed: ${fileRes.status}`);
    }

    const arrayBuffer = await fileRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    this.logger.debug(`Downloaded ${filePath} — ${(buffer.length / 1024).toFixed(1)} KB`);
    return { buffer, size: buffer.length, filePath };
  }

  isLargeFile(sizeBytes: number): boolean {
    return sizeBytes > WARN_SIZE_BYTES;
  }
}
