import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AccessTokenPayload } from './jwt.service';

/**
 * Extract the authenticated user from the request object.
 * The user is attached by JwtAuthGuard after successful token verification.
 *
 * @param property - Optional property name to extract a single field.
 *
 * @example
 * ```ts
 * // Get the full user payload
 * @Get('me')
 * getMe(@CurrentUser() user: AccessTokenPayload) {
 *   return user;
 * }
 *
 * // Get just the userId
 * @Get('me/id')
 * getMyId(@CurrentUser('userId') userId: string) {
 *   return { userId };
 * }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (property: keyof AccessTokenPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request & { user: AccessTokenPayload }>();
    const user = request.user;

    if (!user) {
      return undefined;
    }

    return property ? user[property] : user;
  },
);
