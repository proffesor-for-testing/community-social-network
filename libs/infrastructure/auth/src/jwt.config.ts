import { registerAs } from '@nestjs/config';

export interface JwtConfigOptions {
  accessSecret: string;
  refreshSecret: string;
  accessTtl: string;
  refreshTtl: string;
  issuer: string;
  audience: string;
}

export default registerAs('jwt', (): JwtConfigOptions => {
  const accessSecret = process.env.JWT_ACCESS_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;

  if (process.env.NODE_ENV === 'production') {
    if (!accessSecret) {
      throw new Error('JWT_ACCESS_SECRET environment variable is required in production');
    }
    if (!refreshSecret) {
      throw new Error('JWT_REFRESH_SECRET environment variable is required in production');
    }
  }

  return {
    accessSecret: accessSecret || 'dev-access-secret-do-not-use-in-production',
    refreshSecret: refreshSecret || 'dev-refresh-secret-do-not-use-in-production',
    accessTtl: process.env.JWT_ACCESS_TTL || '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL || '7d',
    issuer: process.env.JWT_ISSUER || 'csn-api',
    audience: process.env.JWT_AUDIENCE || 'csn-web',
  };
});
