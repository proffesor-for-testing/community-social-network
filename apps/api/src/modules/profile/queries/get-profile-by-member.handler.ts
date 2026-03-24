import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { IProfileRepository } from '@csn/domain-profile';
import { UserId } from '@csn/domain-shared';
import { GetProfileByMemberQuery } from './get-profile-by-member.query';
import { ProfileResponseDto } from '../dto/profile-response.dto';

@Injectable()
export class GetProfileByMemberHandler {
  constructor(
    @Inject('IProfileRepository')
    private readonly profileRepository: IProfileRepository,
  ) {}

  async execute(query: GetProfileByMemberQuery): Promise<ProfileResponseDto> {
    const memberId = UserId.create(query.memberId);

    const profile = await this.profileRepository.findByMemberId(memberId);
    if (!profile) {
      throw new NotFoundException(
        `Profile not found for member: ${query.memberId}`,
      );
    }

    return ProfileResponseDto.fromDomain(profile);
  }
}
