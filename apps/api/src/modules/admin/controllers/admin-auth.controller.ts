import {
  Controller,
  Post,
  Body,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { AdminLoginDto } from '../dto/admin-login.dto';
import { Verify2faDto } from '../dto/verify-2fa.dto';
import { AdminLoginHandler } from '../commands/admin-login.handler';
import { Verify2faHandler } from '../commands/verify-2fa.handler';

@ApiTags('admin')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    private readonly adminLoginHandler: AdminLoginHandler,
    private readonly verify2faHandler: Verify2faHandler,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin login' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 403, description: 'Account not active' })
  async login(@Body() dto: AdminLoginDto, @Req() req: Request) {
    const ipAddress = this.extractIpAddress(req);

    const result = await this.adminLoginHandler.execute({
      email: dto.email,
      password: dto.password,
      ipAddress,
    });

    return result;
  }

  @Post('verify-2fa')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify 2FA code during admin login' })
  @ApiResponse({ status: 200, description: '2FA verified successfully' })
  @ApiResponse({ status: 401, description: 'Invalid 2FA code' })
  async verify2fa(@Body() dto: Verify2faDto, @Req() req: Request) {
    // The adminId would come from a temporary session token issued during login
    // For now, extract from a header or query param as a placeholder
    const adminId = req.headers['x-admin-id'] as string;
    const ipAddress = this.extractIpAddress(req);

    const result = await this.verify2faHandler.execute({
      adminId,
      code: dto.code,
      ipAddress,
    });

    return result;
  }

  private extractIpAddress(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return req.ip ?? '127.0.0.1';
  }
}
