import { Injectable, Inject, ConflictException } from '@nestjs/common';
import {
  Profile,
  ProfileId,
  DisplayName,
  IProfileRepository,
} from '@csn/domain-profile';
import { UserId, Email } from '@csn/domain-shared';
import { CreateProfileCommand } from './create-profile.command';
import { ProfileResponseDto } from '../dto/profile-response.dto';

@Injectable()
export class CreateProfileHandler {
  constructor(
    @Inject('IProfileRepository')
    private readonly profileRepository: IProfileRepository,
  ) {}

  async execute(command: CreateProfileCommand): Promise<ProfileResponseDto> {
    const memberId = UserId.create(command.memberId);

    // Check if profile already exists for this member
    const existing = await this.profileRepository.findByMemberId(memberId);
    if (existing) {
      throw new ConflictException(
        `Profile already exists for member ${command.memberId}`,
      );
    }

    const profileId = ProfileId.generate();
    const displayName = DisplayName.create(command.displayName);
    const email = Email.create(command.email);

    const profile = Profile.create(profileId, memberId, displayName, email);

    await this.profileRepository.save(profile);

    return ProfileResponseDto.fromDomain(profile);
  }
}
