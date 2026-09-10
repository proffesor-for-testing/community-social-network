import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Public, CurrentUser, AccessTokenPayload } from '@csn/infra-auth';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { AuthResponseDto } from '../dto/auth-response.dto';
import { MemberResponseDto } from '../dto/member-response.dto';
import { RegisterMemberCommand } from '../commands/register-member.command';
import { RegisterMemberHandler } from '../commands/register-member.handler';
import { LoginMemberCommand } from '../commands/login-member.command';
import { LoginMemberHandler } from '../commands/login-member.handler';
import { LogoutMemberCommand } from '../commands/logout-member.command';
import { LogoutMemberHandler } from '../commands/logout-member.handler';
import { RefreshTokenCommand } from '../commands/refresh-token.command';
import { RefreshTokenHandler } from '../commands/refresh-token.handler';
import { GetCurrentMemberQuery } from '../queries/get-current-member.query';
import { GetCurrentMemberHandler } from '../queries/get-current-member.handler';
import {
  setRefreshCookie,
  clearRefreshCookie,
  readRefreshCookie,
} from '../utils/refresh-cookie';

@ApiTags('Authentication')
@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly registerHandler: RegisterMemberHandler,
    private readonly loginHandler: LoginMemberHandler,
    private readonly logoutHandler: LogoutMemberHandler,
    private readonly refreshHandler: RefreshTokenHandler,
    private readonly getCurrentMemberHandler: GetCurrentMemberHandler,
  ) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new member account' })
  @ApiResponse({ status: 201, description: 'Member registered successfully', type: AuthResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const command = new RegisterMemberCommand(dto.email, dto.displayName, dto.password);
    const result = await this.registerHandler.execute(command);
    setRefreshCookie(res, result.refreshToken);
    return result;
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 403, description: 'Account locked or suspended' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const command = new LoginMemberCommand(dto.email, dto.password);
    const result = await this.loginHandler.execute(command);
    setRefreshCookie(res, result.refreshToken);
    return result;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh an expired access token' })
  @ApiResponse({ status: 200, description: 'Tokens refreshed successfully', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(
    @Req() req: Request,
    @Body() dto: RefreshTokenDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const token = readRefreshCookie(req) ?? dto.refreshToken;
    if (!token) {
      throw new UnauthorizedException('Refresh token missing');
    }
    const command = new RefreshTokenCommand(token);
    const result = await this.refreshHandler.execute(command);
    setRefreshCookie(res, result.refreshToken);
    return result;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and invalidate all tokens' })
  @ApiResponse({ status: 204, description: 'Logged out successfully' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async logout(
    @CurrentUser() user: AccessTokenPayload,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const command = new LogoutMemberCommand(user.userId, user.jti);
    await this.logoutHandler.execute(command);
    clearRefreshCookie(res);
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated member profile' })
  @ApiResponse({ status: 200, description: 'Current member profile', type: MemberResponseDto })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async me(@CurrentUser() user: AccessTokenPayload): Promise<MemberResponseDto> {
    const query = new GetCurrentMemberQuery(user.userId, user.roles ?? []);
    return this.getCurrentMemberHandler.execute(query);
  }
}
