import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CurrentUser } from '@csn/infra-auth';

import { StartConversationDto } from '../dto/start-conversation.dto';
import { SendMessageDto } from '../dto/send-message.dto';
import { MessageQueryDto } from '../dto/message-query.dto';
import { ConversationResponseDto } from '../dto/conversation-response.dto';
import { MessageResponseDto } from '../dto/message-response.dto';

import { StartConversationHandler } from '../commands/start-conversation.handler';
import { StartConversationCommand } from '../commands/start-conversation.command';
import { SendMessageHandler } from '../commands/send-message.handler';
import { SendMessageCommand } from '../commands/send-message.command';
import {
  MarkConversationReadHandler,
  MarkConversationReadResult,
} from '../commands/mark-conversation-read.handler';
import { MarkConversationReadCommand } from '../commands/mark-conversation-read.command';

import {
  ListConversationsHandler,
  ConversationListResult,
} from '../queries/list-conversations.handler';
import { ListConversationsQuery } from '../queries/list-conversations.query';
import {
  GetMessagesHandler,
  MessagePageResult,
} from '../queries/get-messages.handler';
import { GetMessagesQuery } from '../queries/get-messages.query';

const DEFAULT_MESSAGE_PAGE_SIZE = 30;

@ApiTags('conversations')
@ApiBearerAuth()
@Controller('api/conversations')
export class ConversationController {
  constructor(
    private readonly listConversationsHandler: ListConversationsHandler,
    private readonly getMessagesHandler: GetMessagesHandler,
    private readonly startConversationHandler: StartConversationHandler,
    private readonly sendMessageHandler: SendMessageHandler,
    private readonly markConversationReadHandler: MarkConversationReadHandler,
  ) {}

  @Get()
  @ApiOperation({ summary: "List the viewer's conversations, newest activity first" })
  @ApiResponse({ status: 200, description: 'Conversations with last message and unread count' })
  async listConversations(
    @CurrentUser('userId') userId: string,
  ): Promise<ConversationListResult> {
    return this.listConversationsHandler.execute(
      new ListConversationsQuery(userId),
    );
  }

  @Post()
  @ApiOperation({ summary: 'Find or create the conversation with another member' })
  @ApiResponse({ status: 201, description: 'The conversation', type: ConversationResponseDto })
  @ApiResponse({ status: 400, description: 'Self-messaging or a blocked pair' })
  async startConversation(
    @CurrentUser('userId') userId: string,
    @Body() dto: StartConversationDto,
  ): Promise<ConversationResponseDto> {
    return this.startConversationHandler.execute(
      new StartConversationCommand(userId, dto.recipientId),
    );
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Read a page of a conversation, oldest to newest' })
  @ApiResponse({ status: 200, description: 'A page of messages' })
  @ApiResponse({ status: 403, description: 'Not a participant' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async getMessages(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
    @Query() query: MessageQueryDto,
  ): Promise<MessagePageResult> {
    return this.getMessagesHandler.execute(
      new GetMessagesQuery(
        id,
        userId,
        query.cursor ?? null,
        query.limit ?? DEFAULT_MESSAGE_PAGE_SIZE,
      ),
    );
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Send a message into a conversation' })
  @ApiResponse({ status: 201, description: 'The created message', type: MessageResponseDto })
  @ApiResponse({ status: 400, description: 'Empty, oversized, or blocked message' })
  @ApiResponse({ status: 403, description: 'Not a participant' })
  async sendMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: SendMessageDto,
  ): Promise<MessageResponseDto> {
    return this.sendMessageHandler.execute(
      new SendMessageCommand(id, userId, dto.content),
    );
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Mark the viewer's unread messages in a conversation as read" })
  @ApiResponse({ status: 200, description: 'Number of messages marked read' })
  @ApiResponse({ status: 403, description: 'Not a participant' })
  async markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
  ): Promise<MarkConversationReadResult> {
    return this.markConversationReadHandler.execute(
      new MarkConversationReadCommand(id, userId),
    );
  }
}
