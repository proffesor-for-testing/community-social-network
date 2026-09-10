// Value Objects
export { ConversationId } from './value-objects/conversation-id';
export { MessageId } from './value-objects/message-id';
export {
  MessageContent,
  MESSAGE_CONTENT_MIN_LENGTH,
  MESSAGE_CONTENT_MAX_LENGTH,
} from './value-objects/message-content';
export { ParticipantPair } from './value-objects/participant-pair';

// Domain Events
export { ConversationStartedEvent } from './events/conversation-started.event';
export { MessageSentEvent } from './events/message-sent.event';
export { MessageReadEvent } from './events/message-read.event';

// Aggregates
export { Conversation } from './aggregates/conversation';
export { Message } from './aggregates/message';

// Repository Interfaces
export { IConversationRepository } from './repositories/conversation.repository';
export { IMessageRepository, MessagePage } from './repositories/message.repository';

// Errors
export { CannotMessageSelfError } from './errors/cannot-message-self.error';
export { NotAParticipantError } from './errors/not-a-participant.error';
