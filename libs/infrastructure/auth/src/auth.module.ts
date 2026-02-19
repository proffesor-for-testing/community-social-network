import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import jwtConfig from './jwt.config';
import { JwtTokenService } from './jwt.service';
import { JwtAuthGuard } from './auth.guard';
import { TokenBlacklistService } from './token-blacklist.service';
import { KeyRotationService } from './key-rotation.service';

/** Injection token for the custom JWT service. */
export const JWT_SERVICE = 'JWT_SERVICE';

/** Injection token for the token blacklist service. */
export const TOKEN_BLACKLIST = 'TOKEN_BLACKLIST';

@Global()
@Module({
  imports: [
    ConfigModule.forFeature(jwtConfig),
    JwtModule.register({}),
  ],
  providers: [
    JwtTokenService,
    JwtAuthGuard,
    TokenBlacklistService,
    KeyRotationService,
    {
      provide: JWT_SERVICE,
      useExisting: JwtTokenService,
    },
    {
      provide: TOKEN_BLACKLIST,
      useExisting: TokenBlacklistService,
    },
  ],
  exports: [
    JwtTokenService,
    JwtAuthGuard,
    TokenBlacklistService,
    KeyRotationService,
    JWT_SERVICE,
    TOKEN_BLACKLIST,
  ],
})
export class AuthModule {}
