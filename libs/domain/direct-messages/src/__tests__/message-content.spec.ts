import { describe, it, expect } from 'vitest';
import { ValidationError } from '@csn/domain-shared';
import {
  MessageContent,
  MESSAGE_CONTENT_MAX_LENGTH,
} from '../value-objects/message-content';

describe('MessageContent', () => {
  it('should keep the text of a normal message', () => {
    // Arrange
    const text = 'Hey, are we still on for tomorrow?';

    // Act
    const content = MessageContent.create(text);

    // Assert
    expect(content.value).toBe(text);
  });

  it('should trim surrounding whitespace', () => {
    // Arrange
    const text = '   hello   ';

    // Act
    const content = MessageContent.create(text);

    // Assert
    expect(content.value).toBe('hello');
  });

  it('should reject an empty string', () => {
    // Arrange
    const text = '';

    // Act
    const act = () => MessageContent.create(text);

    // Assert
    expect(act).toThrow(ValidationError);
  });

  it('should reject content that is only whitespace', () => {
    // Arrange
    const text = '    \n\t  ';

    // Act
    const act = () => MessageContent.create(text);

    // Assert
    expect(act).toThrow(ValidationError);
  });

  it('should accept a single character as the lower boundary', () => {
    // Arrange
    const text = 'x';

    // Act
    const content = MessageContent.create(text);

    // Assert
    expect(content.length).toBe(1);
  });

  it('should accept content of exactly the maximum length', () => {
    // Arrange
    const text = 'a'.repeat(MESSAGE_CONTENT_MAX_LENGTH);

    // Act
    const content = MessageContent.create(text);

    // Assert
    expect(content.length).toBe(MESSAGE_CONTENT_MAX_LENGTH);
  });

  it('should reject content one character over the maximum length', () => {
    // Arrange
    const text = 'a'.repeat(MESSAGE_CONTENT_MAX_LENGTH + 1);

    // Act
    const act = () => MessageContent.create(text);

    // Assert
    expect(act).toThrow(ValidationError);
  });

  it('should measure length after trimming so padding does not count toward the cap', () => {
    // Arrange
    const text = `  ${'a'.repeat(MESSAGE_CONTENT_MAX_LENGTH)}  `;

    // Act
    const content = MessageContent.create(text);

    // Assert
    expect(content.length).toBe(MESSAGE_CONTENT_MAX_LENGTH);
  });
});
