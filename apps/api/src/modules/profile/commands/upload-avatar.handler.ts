import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  IProfileRepository,
  ProfileId,
  AvatarId,
} from '@csn/domain-profile';
import { UserId, MEDIA_LIMITS } from '@csn/domain-shared';
import { UploadAvatarCommand } from './upload-avatar.command';
import { UploadAvatarResponseDto } from '../dto/upload-avatar.dto';

const ALLOWED_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_AVATAR_SIZE = MEDIA_LIMITS?.MAX_AVATAR_SIZE ?? 5 * 1024 * 1024; // 5MB fallback

@Injectable()
export class UploadAvatarHandler {
  constructor(
    @Inject('IProfileRepository')
    private readonly profileRepository: IProfileRepository,
  ) {}

  async execute(command: UploadAvatarCommand): Promise<UploadAvatarResponseDto> {
    const profileId = ProfileId.create(command.profileId);
    const requesterId = UserId.create(command.requesterId);

    const profile = await this.profileRepository.findById(profileId);
    if (!profile) {
      throw new NotFoundException(`Profile not found: ${command.profileId}`);
    }

    if (!profile.memberId.equals(requesterId)) {
      throw new ForbiddenException('You can only update your own profile');
    }

    // Validate file
    if (!command.file) {
      throw new BadRequestException('No file provided');
    }

    if (!ALLOWED_MIMETYPES.includes(command.file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed: ${ALLOWED_MIMETYPES.join(', ')}`,
      );
    }

    if (command.file.size > MAX_AVATAR_SIZE) {
      throw new BadRequestException(
        `File too large. Maximum size: ${MAX_AVATAR_SIZE / 1024 / 1024}MB`,
      );
    }

    // In a full implementation, the file buffer would be uploaded to
    // object storage (S3, R2, etc.) here. For now, we generate a new
    // avatar ID that would reference the stored file.
    const avatarId = AvatarId.generate();
    profile.changeAvatar(avatarId);

    await this.profileRepository.save(profile);

    return {
      avatarId: avatarId.value!,
      message: 'Avatar uploaded successfully',
    };
  }
}
