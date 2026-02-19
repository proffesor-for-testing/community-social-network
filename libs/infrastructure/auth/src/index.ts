// @csn/infra-auth - Authentication infrastructure module

// Configuration
export { default as jwtConfig } from './jwt.config';
export type { JwtConfigOptions } from './jwt.config';

// JWT service and types
export { JwtTokenService } from './jwt.service';
export type {
  TokenPayload,
  AccessTokenPayload,
  RefreshTokenPayload,
  TokenPair,
} from './jwt.service';

// Auth guard and public decorator
export { JwtAuthGuard, Public, IS_PUBLIC_KEY } from './auth.guard';

// Current user decorator
export { CurrentUser } from './current-user.decorator';

// Token blacklist service and Redis injection token
export { TokenBlacklistService, REDIS_CLIENT } from './token-blacklist.service';

// Key rotation service
export { KeyRotationService } from './key-rotation.service';

// Module and injection tokens
export { AuthModule, JWT_SERVICE, TOKEN_BLACKLIST } from './auth.module';
