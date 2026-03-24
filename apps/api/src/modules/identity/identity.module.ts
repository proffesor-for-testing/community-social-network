import { Module } from '@nestjs/common';
import { IdentityInfrastructureModule } from '@csn/infra-identity';
import { AuthModule } from '@csn/infra-auth';
import { AuthController } from './controllers/auth.controller';
import { RegisterMemberHandler } from './commands/register-member.handler';
import { LoginMemberHandler } from './commands/login-member.handler';
import { LogoutMemberHandler } from './commands/logout-member.handler';
import { RefreshTokenHandler } from './commands/refresh-token.handler';
import { GetCurrentMemberHandler } from './queries/get-current-member.handler';

@Module({
  imports: [
    IdentityInfrastructureModule,
    AuthModule,
  ],
  controllers: [AuthController],
  providers: [
    RegisterMemberHandler,
    LoginMemberHandler,
    LogoutMemberHandler,
    RefreshTokenHandler,
    GetCurrentMemberHandler,
  ],
})
export class IdentityModule {}
