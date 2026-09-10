import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock @nestjs/swagger before any imports that use it
vi.mock('@nestjs/swagger', () => ({
  ApiTags: () => () => {},
  ApiBearerAuth: () => () => {},
  ApiOperation: () => () => {},
  ApiResponse: () => () => {},
  ApiProperty: () => () => {},
  ApiPropertyOptional: () => () => {},
}));

import { ConversationController } from '../controllers/conversation.controller';
import { ListConversationsHandler } from '../queries/list-conversations.handler';
import { GetMessagesHandler } from '../queries/get-messages.handler';
import { StartConversationHandler } from '../commands/start-conversation.handler';
import { SendMessageHandler } from '../commands/send-message.handler';
import { MarkConversationReadHandler } from '../commands/mark-conversation-read.handler';
import { MessageQueryDto } from '../dto/message-query.dto';
import { StartConversationDto } from '../dto/start-conversation.dto';
import { SendMessageDto } from '../dto/send-message.dto';

const VIEWER = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const RECIPIENT = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
const CONVERSATION = 'c3d4e5f6-a7b8-9012-cdef-123456789012';

let listConversationsHandler: { execute: ReturnType<typeof vi.fn> };
let getMessagesHandler: { execute: ReturnType<typeof vi.fn> };
let startConversationHandler: { execute: ReturnType<typeof vi.fn> };
let sendMessageHandler: { execute: ReturnType<typeof vi.fn> };
let markReadHandler: { execute: ReturnType<typeof vi.fn> };
let controller: ConversationController;

beforeEach(() => {
  listConversationsHandler = { execute: vi.fn().mockResolvedValue({ items: [], totalUnread: 0 }) };
  getMessagesHandler = {
    execute: vi.fn().mockResolvedValue({ items: [], nextCursor: null, hasMore: false }),
  };
  startConversationHandler = { execute: vi.fn().mockResolvedValue({ id: CONVERSATION }) };
  sendMessageHandler = { execute: vi.fn().mockResolvedValue({ id: 'm1' }) };
  markReadHandler = { execute: vi.fn().mockResolvedValue({ markedCount: 0 }) };

  controller = new ConversationController(
    listConversationsHandler as unknown as ListConversationsHandler,
    getMessagesHandler as unknown as GetMessagesHandler,
    startConversationHandler as unknown as StartConversationHandler,
    sendMessageHandler as unknown as SendMessageHandler,
    markReadHandler as unknown as MarkConversationReadHandler,
  );
});

describe('GET /api/conversations', () => {
  it('should list conversations for the authenticated viewer', async () => {
    // Act
    await controller.listConversations(VIEWER);

    // Assert
    expect(listConversationsHandler.execute).toHaveBeenCalledWith(
      expect.objectContaining({ viewerId: VIEWER }),
    );
  });

  it('should return the handler result unchanged', async () => {
    // Arrange
    const expected = { items: [], totalUnread: 3 };
    listConversationsHandler.execute.mockResolvedValue(expected);

    // Act
    const result = await controller.listConversations(VIEWER);

    // Assert
    expect(result).toEqual(expected);
  });
});

describe('POST /api/conversations', () => {
  it('should pass the viewer as the initiator', async () => {
    // Arrange
    const dto = new StartConversationDto();
    dto.recipientId = RECIPIENT;

    // Act
    await controller.startConversation(VIEWER, dto);

    // Assert
    expect(startConversationHandler.execute).toHaveBeenCalledWith(
      expect.objectContaining({ initiatorId: VIEWER, recipientId: RECIPIENT }),
    );
  });
});

describe('GET /api/conversations/:id/messages', () => {
  it('should default the page size when no limit is given', async () => {
    // Arrange
    const query = new MessageQueryDto();

    // Act
    await controller.getMessages(CONVERSATION, VIEWER, query);

    // Assert
    expect(getMessagesHandler.execute).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 30 }),
    );
  });

  it('should default the cursor to null when none is given', async () => {
    // Arrange
    const query = new MessageQueryDto();

    // Act
    await controller.getMessages(CONVERSATION, VIEWER, query);

    // Assert
    expect(getMessagesHandler.execute).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: null }),
    );
  });

  it('should forward the cursor and limit from the query string', async () => {
    // Arrange
    const query = new MessageQueryDto();
    query.cursor = 'd4e5f6a7-b8c9-0123-def1-234567890123';
    query.limit = 5;

    // Act
    await controller.getMessages(CONVERSATION, VIEWER, query);

    // Assert
    expect(getMessagesHandler.execute).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: query.cursor, limit: 5 }),
    );
  });
});

describe('POST /api/conversations/:id/messages', () => {
  it('should pass the viewer as the sender', async () => {
    // Arrange
    const dto = new SendMessageDto();
    dto.content = 'hello';

    // Act
    await controller.sendMessage(CONVERSATION, VIEWER, dto);

    // Assert
    expect(sendMessageHandler.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: CONVERSATION,
        senderId: VIEWER,
        content: 'hello',
      }),
    );
  });
});

describe('POST /api/conversations/:id/read', () => {
  it('should mark the conversation read for the viewer', async () => {
    // Act
    await controller.markRead(CONVERSATION, VIEWER);

    // Assert
    expect(markReadHandler.execute).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: CONVERSATION, viewerId: VIEWER }),
    );
  });

  it('should return the number of messages marked read', async () => {
    // Arrange
    markReadHandler.execute.mockResolvedValue({ markedCount: 4 });

    // Act
    const result = await controller.markRead(CONVERSATION, VIEWER);

    // Assert
    expect(result.markedCount).toBe(4);
  });
});
