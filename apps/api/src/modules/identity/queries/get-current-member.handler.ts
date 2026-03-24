import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { IMemberRepository, MemberId } from '@csn/domain-identity';
import { MEMBER_REPOSITORY_TOKEN } from '@csn/infra-identity';
import { GetCurrentMemberQuery } from './get-current-member.query';
import { MemberResponseDto } from '../dto/member-response.dto';

@Injectable()
export class GetCurrentMemberHandler {
  constructor(
    @Inject(MEMBER_REPOSITORY_TOKEN)
    private readonly memberRepository: IMemberRepository,
  ) {}

  async execute(query: GetCurrentMemberQuery): Promise<MemberResponseDto> {
    const memberId = MemberId.create(query.memberId);
    const member = await this.memberRepository.findById(memberId);

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    return MemberResponseDto.fromDomain(member);
  }
}
