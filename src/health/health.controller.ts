import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ShortTermService } from '../memory/short-term.service';

@Controller('health')
export class HealthController {
  private readonly startTime = Date.now();

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly shortTerm: ShortTermService,
  ) {}

  @Get()
  async check(@Res() res: Response) {
    const [dbStatus, redisStatus] = await Promise.all([
      this.checkDb(),
      this.checkRedis(),
    ]);

    const healthy = dbStatus === 'ok' && redisStatus === 'ok';
    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);

    return res.status(healthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).json({
      status: healthy ? 'ok' : 'degraded',
      db: dbStatus,
      redis: redisStatus,
      uptime: uptimeSeconds,
    });
  }

  private async checkDb(): Promise<string> {
    try {
      await this.dataSource.query('SELECT 1');
      return 'ok';
    } catch {
      return 'error';
    }
  }

  private async checkRedis(): Promise<string> {
    try {
      const pong = await this.shortTerm.ping();
      return pong === 'PONG' ? 'ok' : 'error';
    } catch {
      return 'error';
    }
  }
}
