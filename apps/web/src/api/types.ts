/* -----------------------------------------------------------------
 * Shared API types matching backend DTOs across all bounded contexts
 * ----------------------------------------------------------------- */

// ── Generic ──────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiErrorResponse {
  statusCode: number;
  message: string;
  error?: string;
  details?: Record<string, string[]>;
}

// ── Identity ─────────────────────────────────────────────────────

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  email: string;
  username: string;
  password: string;
  displayName: string;
}

export interface AuthTokensDto {
  accessToken: string;
  expiresIn: number;
}

export interface CurrentUserDto {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: 'member' | 'moderator' | 'admin';
  createdAt: string;
}

export interface SessionDto {
  id: string;
  memberId: string;
  ipAddress: string;
  userAgent: string;
  lastActiveAt: string;
  createdAt: string;
}

// ── Profile ──────────────────────────────────────────────────────

export interface ProfileDto {
  id: string;
  memberId: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  location: string | null;
  website: string | null;
  joinedAt: string;
}

export interface UpdateProfileDto {
  displayName?: string;
  bio?: string;
  location?: string;
  website?: string;
}

// ── Content ──────────────────────────────────────────────────────

export interface PublicationDto {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  title: string | null;
  body: string;
  type: 'post' | 'article';
  status: 'draft' | 'published' | 'archived';
  tags: string[];
  reactionCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePublicationDto {
  title?: string;
  body: string;
  type: 'post' | 'article';
  tags?: string[];
}

export interface DiscussionDto {
  id: string;
  publicationId: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  body: string;
  parentId: string | null;
  reactionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDiscussionDto {
  publicationId: string;
  body: string;
  parentId?: string;
}

// ── Social Graph ─────────────────────────────────────────────────

export interface ConnectionDto {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

export interface SendConnectionRequestDto {
  addresseeId: string;
}

// ── Community ────────────────────────────────────────────────────

export interface GroupDto {
  id: string;
  name: string;
  description: string;
  visibility: 'public' | 'private' | 'secret';
  memberCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGroupDto {
  name: string;
  description: string;
  visibility: 'public' | 'private' | 'secret';
}

export interface MembershipDto {
  id: string;
  groupId: string;
  memberId: string;
  role: 'member' | 'moderator' | 'admin';
  joinedAt: string;
}

// ── Notification ─────────────────────────────────────────────────

export interface AlertDto {
  id: string;
  recipientId: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface NotificationPreferenceDto {
  id: string;
  memberId: string;
  channel: 'in_app' | 'email' | 'push';
  type: string;
  enabled: boolean;
}

// ── Admin ────────────────────────────────────────────────────────

export interface AuditEntryDto {
  id: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
  timestamp: string;
}
