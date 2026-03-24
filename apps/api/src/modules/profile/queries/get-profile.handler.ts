import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { IProfileRepository, ProfileId } from '@csn/domain-profile';
import { GetProfileQuery } from './get-profile.query';
import { ProfileResponseDto } from '../dto/profile-response.dto';

@Injectable()
export class GetProfileHandler {
  constructor(
    @Inject('IProfileRepository')
    private readonly profileRepository: IProfileRepository,
  ) {}

  async execute(query: GetProfileQuery): Promise<ProfileResponseDto> {
    const profileId = ProfileId.create(query.profileId);

    const profile = await this.profileRepository.findById(profileId);
    if (!profile) {
      throw new NotFoundException(`Profile not found: ${query.profileId}`);
    }

    return ProfileResponseDto.fromDomain(profile);
  }
}
