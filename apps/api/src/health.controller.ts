import { Controller, Get, Inject, HttpStatus, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '@csn/infra-auth';
import { REDIS_CLIENT } from '@csn/infra-cache';
import { DataSource } from 'typeorm';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: { ping: () => Promise<string> },
  ) {}

  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Basic liveness check' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('live')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  live() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('ready')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Readiness probe - checks DB and Redis connectivity' })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  @ApiResponse({ status: 503, description: 'Service is not ready' })
  async ready() {
    const checks: Record<string, { status: string; latency?: number; error?: string }> = {};

    // Check database
    const dbStart = Date.now();
    try {
      await this.dataSource.query('SELECT 1');
      checks['database'] = {
        status: 'up',
        latency: Date.now() - dbStart,
      };
    } catch (error) {
      checks['database'] = {
        status: 'down',
        latency: Date.now() - dbStart,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // Check Redis
    const redisStart = Date.now();
    try {
      await this.redis.ping();
      checks['redis'] = {
        status: 'up',
        latency: Date.now() - redisStart,
      };
    } catch (error) {
      checks['redis'] = {
        status: 'down',
        latency: Date.now() - redisStart,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    const allUp = Object.values(checks).every((c) => c.status === 'up');

    return {
      status: allUp ? 'ready' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    };
  }
}
