import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { UserId } from '@csn/domain-shared';
import {
  ParticipantPair,
  IConversationRepository,
} from '@csn/domain-direct-messages';
import { IBlockRepository } from '@csn/domain-social-graph';
import { IProfileRepository } from '@csn/domain-profile';
import { CONVERSATION_REPOSITORY_TOKEN } from '@csn/infra-direct-messages';
import { StartConversationCommand } from './start-conversation.command';
import { ConversationResponseDto } from '../dto/conversation-response.dto';

/**
 * Find-or-create for a 1:1 conversation. Blocking is enforced here rather than
 * in the domain, because the block relation lives in the social-graph context
 * and the aggregate must not reach across contexts to load it.
 */
@Injectable()
export class StartConversationHandler {
  constructor(
    @Inject(CONVERSATION_REPOSITORY_TOKEN)
    private readonly conversationRepo: IConversationRepository,
    @Inject('IBlockRepository')
    private readonly blockRepo: IBlockRepository,
    @Inject('IProfileRepository')
    private readonly profileRepo: IProfileRepository,
  ) {}

  async execute(command: StartConversationCommand): Promise<ConversationResponseDto> {
    const { initiatorId, recipientId } = command;

    if (initiatorId === recipientId) {
      throw new BadRequestException('Cannot start a conversation with yourself');
    }

    const initiator = UserId.create(initiatorId);
    const recipient = UserId.create(recipientId);

    if (await this.blockRepo.isBlocked(initiator, recipient)) {
      throw new BadRequestException('Cannot message this member');
    }

    const pair = ParticipantPair.create(initiator, recipient);
    const conversation = await this.conversationRepo.findOrCreate(pair);

    const profile = await this.profileRepo.findByMemberId(recipient);

    return ConversationResponseDto.fromDomain(
      conversation,
      initiator,
      profile?.displayName.value ?? 'Member',
    );
  }
}
