export { ProfileModule } from './profile.module';

// DTOs
export { UpdateProfileDto } from './dto/update-profile.dto';
export { ProfileResponseDto } from './dto/profile-response.dto';
export { UploadAvatarDto, UploadAvatarResponseDto } from './dto/upload-avatar.dto';

// Commands
export { CreateProfileCommand } from './commands/create-profile.command';
export { CreateProfileHandler } from './commands/create-profile.handler';
export { UpdateProfileCommand } from './commands/update-profile.command';
export { UpdateProfileHandler } from './commands/update-profile.handler';
export { UploadAvatarCommand } from './commands/upload-avatar.command';
export { UploadAvatarHandler } from './commands/upload-avatar.handler';

// Queries
export { GetProfileQuery } from './queries/get-profile.query';
export { GetProfileHandler } from './queries/get-profile.handler';
export { GetProfileByMemberQuery } from './queries/get-profile-by-member.query';
export { GetProfileByMemberHandler } from './queries/get-profile-by-member.handler';
