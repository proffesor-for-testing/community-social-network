/**
 * MentionService
 * Handles @mention extraction, validation, and notification
 *
 * Features:
 * - Extract @usernames from comment content
 * - Validate mentioned users exist
 * - Create mention records
 * - Trigger notifications for mentions
 */

import {
  CommentMention,
  MAX_MENTIONS_PER_COMMENT
} from './comment.types';

// ============================================================================
// INTERFACES
// ============================================================================

export interface UserRepository {
  findByUsernames(usernames: string[]): Promise<Array<{ id: string; username: string }>>;
}

export interface MentionRepository {
  createBatch(commentId: string, userIds: string[]): Promise<Array<{
    id: string;
    commentId: string;
    mentionedUserId: string;
  }>>;
  findByCommentId(commentId: string): Promise<Array<{
    id: string;
    commentId: string;
    mentionedUserId: string;
    username: string;
  }>>;
}

export interface NotificationService {
  notifyMention(data: {
    mentionedUserId: string;
    commentId: string;
    authorId?: string;
    postId?: string;
  }): Promise<void>;
}

export interface CreateMentionsOptions {
  authorId?: string;
  postId?: string;
  notify?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Regex pattern for valid @mentions
 * - Must start with @ (preceded by whitespace or start of string)
 * - Username: 3-20 alphanumeric characters or underscores
 * - Must be followed by word boundary (not more alphanumeric chars, hyphens, or dots)
 */
const MENTION_PATTERN = /(?:^|[\s])@([a-zA-Z0-9_]{3,20})(?=[\s.,!?;:'"\)\]]|$)/g;

/**
 * Pattern to exclude email addresses from mention detection
 */
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// ============================================================================
// SERVICE IMPLEMENTATION
// ============================================================================

export class MentionService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly mentionRepository: MentionRepository,
    private readonly notificationService: NotificationService
  ) {}

  /**
   * Extract @mentions from comment content
   *
   * Features:
   * - Extracts valid usernames (3-20 alphanumeric + underscore)
   * - Deduplicates mentions (case-insensitive)
   * - Limits to MAX_MENTIONS_PER_COMMENT (10)
   * - Filters out email addresses
   *
   * @param content - Comment content to parse
   * @returns Array of unique usernames (lowercase, without @ symbol)
   */
  extractMentions(content: string): string[] {
    if (!content || content.length === 0) {
      return [];
    }

    // Remove email addresses to avoid false positives
    const contentWithoutEmails = content.replace(EMAIL_PATTERN, '');

    // Extract all @mentions
    const matches: string[] = [];
    let match: RegExpExecArray | null;

    // Reset regex lastIndex
    MENTION_PATTERN.lastIndex = 0;

    while ((match = MENTION_PATTERN.exec(contentWithoutEmails)) !== null) {
      if (match[1]) {
        const username = match[1].toLowerCase();
        matches.push(username);
      }
    }

    // Deduplicate (case-insensitive)
    const uniqueMentions = [...new Set(matches)];

    // Limit to max mentions
    return uniqueMentions.slice(0, MAX_MENTIONS_PER_COMMENT);
  }

  /**
   * Validate that mentioned usernames exist in the system
   *
   * @param usernames - Array of usernames to validate
   * @returns Array of valid mentions with userId and username
   */
  async validateMentions(usernames: string[]): Promise<CommentMention[]> {
    if (!usernames || usernames.length === 0) {
      return [];
    }

    const users = await this.userRepository.findByUsernames(usernames);

    return users.map(user => ({
      userId: user.id,
      username: user.username
    }));
  }

  /**
   * Create mention records in the database and optionally send notifications
   *
   * @param commentId - ID of the comment containing mentions
   * @param mentions - Array of validated mentions
   * @param options - Creation options (authorId, postId, notify)
   * @returns Array of created mentions
   */
  async createMentions(
    commentId: string,
    mentions: CommentMention[],
    options: CreateMentionsOptions = {}
  ): Promise<CommentMention[]> {
    if (!mentions || mentions.length === 0) {
      return [];
    }

    const { authorId, postId, notify = false } = options;

    // Create mention records in database
    const userIds = mentions.map(m => m.userId);
    await this.mentionRepository.createBatch(commentId, userIds);

    // Send notifications if enabled
    if (notify && authorId && postId) {
      for (const mention of mentions) {
        // Don't notify if user mentions themselves
        if (mention.userId !== authorId) {
          await this.notificationService.notifyMention({
            mentionedUserId: mention.userId,
            commentId,
            authorId,
            postId
          });
        }
      }
    }

    return mentions;
  }

  /**
   * Get all mentions for a specific comment
   *
   * @param commentId - ID of the comment
   * @returns Array of mentions with userId and username
   */
  async getMentionsByComment(commentId: string): Promise<CommentMention[]> {
    const storedMentions = await this.mentionRepository.findByCommentId(commentId);

    return storedMentions.map(m => ({
      userId: m.mentionedUserId,
      username: m.username
    }));
  }

  /**
   * Process mentions for a new comment (extract, validate, create)
   *
   * This is a convenience method that combines all mention operations
   *
   * @param content - Comment content
   * @param commentId - ID of the created comment
   * @param options - Processing options
   * @returns Array of created mentions
   */
  async processMentions(
    content: string,
    commentId: string,
    options: CreateMentionsOptions = {}
  ): Promise<CommentMention[]> {
    // Step 1: Extract @mentions from content
    const extractedUsernames = this.extractMentions(content);

    if (extractedUsernames.length === 0) {
      return [];
    }

    // Step 2: Validate that users exist
    const validMentions = await this.validateMentions(extractedUsernames);

    if (validMentions.length === 0) {
      return [];
    }

    // Step 3: Create mention records and notify
    return this.createMentions(commentId, validMentions, options);
  }
}
