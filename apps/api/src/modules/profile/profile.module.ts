import { Module } from '@nestjs/common';
import { ProfileInfrastructureModule } from '@csn/infra-profile';

import { ProfileController } from './controllers/profile.controller';

// Command handlers
import { CreateProfileHandler } from './commands/create-profile.handler';
import { UpdateProfileHandler } from './commands/update-profile.handler';
import { UploadAvatarHandler } from './commands/upload-avatar.handler';

// Query handlers
import { GetProfileHandler } from './queries/get-profile.handler';
import { GetProfileByMemberHandler } from './queries/get-profile-by-member.handler';

@Module({
  imports: [ProfileInfrastructureModule],
  controllers: [ProfileController],
  providers: [
    // Commands
    CreateProfileHandler,
    UpdateProfileHandler,
    UploadAvatarHandler,
    // Queries
    GetProfileHandler,
    GetProfileByMemberHandler,
  ],
  exports: [CreateProfileHandler],
})
export class ProfileModule {}
