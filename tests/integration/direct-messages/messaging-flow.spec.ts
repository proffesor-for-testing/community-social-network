/**
 * Integration Test: Direct Messages — conversation lifecycle
 *
 * Exercises the messaging flow through the real handlers wired to in-memory
 * repositories.
 *
 * Flow:
 * 1. Alice opens a conversation with Bob
 * 2. Alice sends a message; Bob is notified
 * 3. Bob's inbox shows the thread with an unread badge
 * 4. Bob reads the thread; the badge clears
 * 5. Carol, an outsider, is refused access
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { UserId } from '@csn/domain-shared';
import { Block } from '@csn/domain-social-graph';
import { AlertType } from '@csn/domain-notification';
import { ConversationId, MESSAGE_CONTENT_MAX_LENGTH } from '@csn/domain-direct-messages';

// ── Handlers ────────────────────────────────────────────────────────────────

import { StartConversationHandler } from '../../../apps/api/src/modules/direct-messages/commands/start-conversation.handler';
import { StartConversationCommand } from '../../../apps/api/src/modules/direct-messages/commands/start-conversation.command';
import { SendMessageHandler } from '../../../apps/api/src/modules/direct-messages/commands/send-message.handler';
import { SendMessageCommand } from '../../../apps/api/src/modules/direct-messages/commands/send-message.command';
import { MarkConversationReadHandler } from '../../../apps/api/src/modules/direct-messages/commands/mark-conversation-read.handler';
import { MarkConversationReadCommand } from '../../../apps/api/src/modules/direct-messages/commands/mark-conversation-read.command';
import { ListConversationsHandler } from '../../../apps/api/src/modules/direct-messages/queries/list-conversations.handler';
import { ListConversationsQuery } from '../../../apps/api/src/modules/direct-messages/queries/list-conversations.query';
import { GetMessagesHandler } from '../../../apps/api/src/modules/direct-messages/queries/get-messages.handler';
import { GetMessagesQuery } from '../../../apps/api/src/modules/direct-messages/queries/get-messages.query';
import { AlertCreatorService } from '../../../apps/api/src/modules/notification/services/alert-creator.service';

// ── Test infrastructure ─────────────────────────────────────────────────────

import {
  createTestRepositories,
  TestRepositories,
  BLOCK_REPOSITORY_TOKEN,
  PROFILE_REPOSITORY_TOKEN,
  ALERT_REPOSITORY_TOKEN,
  CONVERSATION_REPOSITORY_TOKEN,
  MESSAGE_REPOSITORY_TOKEN,
} from '../../setup/test-app';
import { createTestProfile } from '../../setup/test-helpers';

describe('Direct Messages: conversation lifecycle', () => {
  let module: TestingModule;
  let repos: TestRepositories;

  let startConversation: StartConversationHandler;
  let sendMessage: SendMessageHandler;
  let markRead: MarkConversationReadHandler;
  let listConversations: ListConversationsHandler;
  let getMessages: GetMessagesHandler;

  const alice = randomUUID();
  const bob = randomUUID();
  const carol = randomUUID();

  async function seedProfile(memberId: string, displayName: string): Promise<void> {
    await repos.profileRepo.save(createTestProfile(memberId, { displayName }));
  }

  beforeEach(async () => {
    repos = createTestRepositories();

    module = await Test.createTestingModule({
      providers: [
        StartConversationHandler,
        // SendMessageHandler's AlertCreatorService parameter is class-typed;
        // vitest's esbuild transform does not emit the design:paramtypes
        // metadata Nest needs, so wire it through an explicit factory.
        {
          provide: SendMessageHandler,
          useFactory: (
            conversationRepo: unknown,
            messageRepo: unknown,
            blockRepo: unknown,
            alerts: AlertCreatorService,
          ) =>
            new SendMessageHandler(
              conversationRepo as never,
              messageRepo as never,
              blockRepo as never,
              alerts,
            ),
          inject: [
            CONVERSATION_REPOSITORY_TOKEN,
            MESSAGE_REPOSITORY_TOKEN,
            BLOCK_REPOSITORY_TOKEN,
            AlertCreatorService,
          ],
        },
        MarkConversationReadHandler,
        ListConversationsHandler,
        GetMessagesHandler,
        AlertCreatorService,
        { provide: CONVERSATION_REPOSITORY_TOKEN, useValue: repos.conversationRepo },
        { provide: MESSAGE_REPOSITORY_TOKEN, useValue: repos.directMessageRepo },
        { provide: BLOCK_REPOSITORY_TOKEN, useValue: repos.blockRepo },
        { provide: PROFILE_REPOSITORY_TOKEN, useValue: repos.profileRepo },
        { provide: ALERT_REPOSITORY_TOKEN, useValue: repos.alertRepo },
      ],
    }).compile();

    startConversation = module.get(StartConversationHandler);
    sendMessage = module.get(SendMessageHandler);
    markRead = module.get(MarkConversationReadHandler);
    listConversations = module.get(ListConversationsHandler);
    getMessages = module.get(GetMessagesHandler);

    await seedProfile(alice, 'Alice Anderson');
    await seedProfile(bob, 'Bob Builder');
  });

  // ── Step 1: opening a conversation ────────────────────────────────────

  it('should open a conversation between two members', async () => {
    // Act
    const conversation = await startConversation.execute(
      new StartConversationCommand(alice, bob),
    );

    // Assert
    expect(conversation.otherParticipant.memberId).toBe(bob);
  });

  it('should reuse the same conversation when the other member opens it', async () => {
    // Arrange
    const opened = await startConversation.execute(
      new StartConversationCommand(alice, bob),
    );

    // Act
    const reopened = await startConversation.execute(
      new StartConversationCommand(bob, alice),
    );

    // Assert
    expect(reopened.id).toBe(opened.id);
  });

  it('should refuse a conversation with yourself', async () => {
    // Act
    const act = startConversation.execute(new StartConversationCommand(alice, alice));

    // Assert
    await expect(act).rejects.toThrow(BadRequestException);
  });

  it('should refuse a conversation with a member who blocked you', async () => {
    // Arrange
    await repos.blockRepo.save(
      Block.create(repos.blockRepo.nextId(), UserId.create(bob), UserId.create(alice)),
    );

    // Act
    const act = startConversation.execute(new StartConversationCommand(alice, bob));

    // Assert
    await expect(act).rejects.toThrow(BadRequestException);
  });

  // ── Step 2: sending ───────────────────────────────────────────────────

  it('should deliver a message into the conversation', async () => {
    // Arrange
    const conversation = await startConversation.execute(
      new StartConversationCommand(alice, bob),
    );

    // Act
    const message = await sendMessage.execute(
      new SendMessageCommand(conversation.id, alice, 'Lunch tomorrow?'),
    );

    // Assert
    expect(message.content).toBe('Lunch tomorrow?');
  });

  it('should raise a MESSAGE alert for the recipient', async () => {
    // Arrange
    const conversation = await startConversation.execute(
      new StartConversationCommand(alice, bob),
    );
    await sendMessage.execute(
      new SendMessageCommand(conversation.id, alice, 'Lunch tomorrow?'),
    );

    // Act
    const alerts = await repos.alertRepo.findByRecipientId(UserId.create(bob));

    // Assert
    expect(alerts.items[0].type).toBe(AlertType.MESSAGE);
  });

  it('should title the alert with the sender display name', async () => {
    // Arrange
    const conversation = await startConversation.execute(
      new StartConversationCommand(alice, bob),
    );
    await sendMessage.execute(new SendMessageCommand(conversation.id, alice, 'Hi'));

    // Act
    const alerts = await repos.alertRepo.findByRecipientId(UserId.create(bob));

    // Assert
    expect(alerts.items[0].content.title).toBe('Alice Anderson sent you a message');
  });

  it('should reject an empty message', async () => {
    // Arrange
    const conversation = await startConversation.execute(
      new StartConversationCommand(alice, bob),
    );

    // Act
    const act = sendMessage.execute(new SendMessageCommand(conversation.id, alice, '   '));

    // Assert
    await expect(act).rejects.toThrow(BadRequestException);
  });

  it('should accept a message of exactly the maximum length', async () => {
    // Arrange
    const conversation = await startConversation.execute(
      new StartConversationCommand(alice, bob),
    );
    const body = 'a'.repeat(MESSAGE_CONTENT_MAX_LENGTH);

    // Act
    const message = await sendMessage.execute(
      new SendMessageCommand(conversation.id, alice, body),
    );

    // Assert
    expect(message.content).toHaveLength(MESSAGE_CONTENT_MAX_LENGTH);
  });

  it('should reject a message one character over the maximum length', async () => {
    // Arrange
    const conversation = await startConversation.execute(
      new StartConversationCommand(alice, bob),
    );
    const body = 'a'.repeat(MESSAGE_CONTENT_MAX_LENGTH + 1);

    // Act
    const act = sendMessage.execute(new SendMessageCommand(conversation.id, alice, body));

    // Assert
    await expect(act).rejects.toThrow(BadRequestException);
  });

  // ── Step 3: the recipient's inbox ─────────────────────────────────────

  it('should show the thread in the recipient inbox with an unread badge', async () => {
    // Arrange
    const conversation = await startConversation.execute(
      new StartConversationCommand(alice, bob),
    );
    await sendMessage.execute(new SendMessageCommand(conversation.id, alice, 'One'));
    await sendMessage.execute(new SendMessageCommand(conversation.id, alice, 'Two'));

    // Act
    const inbox = await listConversations.execute(new ListConversationsQuery(bob));

    // Assert
    expect(inbox.items[0].unreadCount).toBe(2);
  });

  it('should preview the latest message in the inbox', async () => {
    // Arrange
    const conversation = await startConversation.execute(
      new StartConversationCommand(alice, bob),
    );
    await sendMessage.execute(new SendMessageCommand(conversation.id, alice, 'One'));
    await sendMessage.execute(new SendMessageCommand(conversation.id, alice, 'Two'));

    // Act
    const inbox = await listConversations.execute(new ListConversationsQuery(bob));

    // Assert
    expect(inbox.items[0].lastMessage?.content).toBe('Two');
  });

  it('should name the sender as the other participant in the recipient inbox', async () => {
    // Arrange
    const conversation = await startConversation.execute(
      new StartConversationCommand(alice, bob),
    );
    await sendMessage.execute(new SendMessageCommand(conversation.id, alice, 'One'));

    // Act
    const inbox = await listConversations.execute(new ListConversationsQuery(bob));

    // Assert
    expect(inbox.items[0].otherParticipant.displayName).toBe('Alice Anderson');
  });

  it('should not count the sender own messages as unread for them', async () => {
    // Arrange
    const conversation = await startConversation.execute(
      new StartConversationCommand(alice, bob),
    );
    await sendMessage.execute(new SendMessageCommand(conversation.id, alice, 'One'));

    // Act
    const inbox = await listConversations.execute(new ListConversationsQuery(alice));

    // Assert
    expect(inbox.items[0].unreadCount).toBe(0);
  });

  // ── Step 4: reading ───────────────────────────────────────────────────

  it('should clear the unread badge once the thread is read', async () => {
    // Arrange
    const conversation = await startConversation.execute(
      new StartConversationCommand(alice, bob),
    );
    await sendMessage.execute(new SendMessageCommand(conversation.id, alice, 'One'));
    await markRead.execute(new MarkConversationReadCommand(conversation.id, bob));

    // Act
    const inbox = await listConversations.execute(new ListConversationsQuery(bob));

    // Assert
    expect(inbox.items[0].unreadCount).toBe(0);
  });

  it('should leave a message that arrives after the read unread', async () => {
    // Arrange
    const conversation = await startConversation.execute(
      new StartConversationCommand(alice, bob),
    );
    await sendMessage.execute(new SendMessageCommand(conversation.id, alice, 'One'));
    await markRead.execute(new MarkConversationReadCommand(conversation.id, bob));
    await sendMessage.execute(new SendMessageCommand(conversation.id, alice, 'Two'));

    // Act
    const inbox = await listConversations.execute(new ListConversationsQuery(bob));

    // Assert
    expect(inbox.items[0].unreadCount).toBe(1);
  });

  // ── Step 5: reading the thread ────────────────────────────────────────

  it('should return the thread oldest-first', async () => {
    // Arrange
    const conversation = await startConversation.execute(
      new StartConversationCommand(alice, bob),
    );
    await sendMessage.execute(new SendMessageCommand(conversation.id, alice, 'One'));
    await sendMessage.execute(new SendMessageCommand(conversation.id, bob, 'Two'));

    // Act
    const page = await getMessages.execute(new GetMessagesQuery(conversation.id, alice));

    // Assert
    expect(page.items.map((m) => m.content)).toEqual(['One', 'Two']);
  });

  it('should page back through history with the cursor', async () => {
    // Arrange
    const conversation = await startConversation.execute(
      new StartConversationCommand(alice, bob),
    );
    await sendMessage.execute(new SendMessageCommand(conversation.id, alice, 'One'));
    await sendMessage.execute(new SendMessageCommand(conversation.id, alice, 'Two'));
    const firstPage = await getMessages.execute(
      new GetMessagesQuery(conversation.id, alice, null, 1),
    );

    // Act
    const secondPage = await getMessages.execute(
      new GetMessagesQuery(conversation.id, alice, firstPage.nextCursor, 1),
    );

    // Assert
    expect(secondPage.items.map((m) => m.content)).toEqual(['One']);
  });

  // ── Outsiders ─────────────────────────────────────────────────────────

  it('should refuse an outsider reading the thread', async () => {
    // Arrange
    const conversation = await startConversation.execute(
      new StartConversationCommand(alice, bob),
    );

    // Act
    const act = getMessages.execute(new GetMessagesQuery(conversation.id, carol));

    // Assert
    await expect(act).rejects.toThrow(ForbiddenException);
  });

  it('should refuse an outsider sending into the thread', async () => {
    // Arrange
    const conversation = await startConversation.execute(
      new StartConversationCommand(alice, bob),
    );

    // Act
    const act = sendMessage.execute(new SendMessageCommand(conversation.id, carol, 'Hi'));

    // Assert
    await expect(act).rejects.toThrow(ForbiddenException);
  });

  it('should refuse an outsider marking the thread read', async () => {
    // Arrange
    const conversation = await startConversation.execute(
      new StartConversationCommand(alice, bob),
    );

    // Act
    const act = markRead.execute(new MarkConversationReadCommand(conversation.id, carol));

    // Assert
    await expect(act).rejects.toThrow(ForbiddenException);
  });

  it('should report an unknown conversation as not found', async () => {
    // Act
    const act = getMessages.execute(
      new GetMessagesQuery(ConversationId.generate().value, alice),
    );

    // Assert
    await expect(act).rejects.toThrow(NotFoundException);
  });
});
