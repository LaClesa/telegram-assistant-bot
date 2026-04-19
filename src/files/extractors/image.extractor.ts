import { Injectable } from '@nestjs/common';

export interface ImageData {
  base64: string;
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
}

const MIME_FALLBACK = 'image/jpeg';

@Injectable()
export class ImageExtractor {
  extract(buffer: Buffer, mimeType?: string): ImageData {
    const base64 = buffer.toString('base64');
    const mediaType = this.normaliseMediaType(mimeType);
    return { base64, mediaType };
  }

  private normaliseMediaType(
    mimeType?: string,
  ): ImageData['mediaType'] {
    const supported: ImageData['mediaType'][] = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ];
    const lower = (mimeType ?? '').toLowerCase() as ImageData['mediaType'];
    return supported.includes(lower) ? lower : MIME_FALLBACK;
  }
}
