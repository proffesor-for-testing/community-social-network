import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import {
  IProfileRepository,
  ProfileId,
  DisplayName,
  Bio,
  Location,
} from '@csn/domain-profile';
import { UserId } from '@csn/domain-shared';
import { UpdateProfileCommand } from './update-profile.command';
import { ProfileResponseDto } from '../dto/profile-response.dto';

@Injectable()
export class UpdateProfileHandler {
  constructor(
    @Inject('IProfileRepository')
    private readonly profileRepository: IProfileRepository,
  ) {}

  async execute(command: UpdateProfileCommand): Promise<ProfileResponseDto> {
    const profileId = ProfileId.create(command.profileId);
    const requesterId = UserId.create(command.requesterId);

    const profile = await this.profileRepository.findById(profileId);
    if (!profile) {
      throw new NotFoundException(
        `Profile not found: ${command.profileId}`,
      );
    }

    // Only the profile owner can update it
    if (!profile.memberId.equals(requesterId)) {
      throw new ForbiddenException('You can only update your own profile');
    }

    if (command.displayName !== undefined) {
      profile.updateDisplayName(DisplayName.create(command.displayName));
    }

    if (command.bio !== undefined) {
      profile.updateBio(Bio.create(command.bio));
    }

    if (command.city !== undefined || command.country !== undefined) {
      const location = Location.create({
        city: command.city ?? profile.location.city,
        country: command.country ?? profile.location.country,
      });
      profile.updateLocation(location);
    }

    await this.profileRepository.save(profile);

    return ProfileResponseDto.fromDomain(profile);
  }
}
