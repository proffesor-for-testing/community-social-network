import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Publication } from '@csn/domain-content';

export class PostResponseDto {
  @ApiProperty({ description: 'Post ID (UUID)', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id!: string;

  @ApiProperty({ description: 'Author member ID (UUID)', example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901' })
  authorId!: string;

  @ApiProperty({ description: 'Author display name (joined from Profile)', example: 'Jane Doe' })
  authorName!: string;

  @ApiPropertyOptional({ description: 'Author avatar URL', example: 'https://cdn.example.com/avatars/abc.jpg' })
  authorAvatarUrl?: string | null;

  @ApiProperty({ description: 'Post content text', example: 'Hello world!' })
  content!: string;

  @ApiProperty({ description: 'Post visibility', example: 'PUBLIC' })
  visibility!: string;

  @ApiPropertyOptional({
    description: 'Group this post belongs to, or null for a main-feed post',
    example: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    nullable: true,
  })
  groupId!: string | null;

  @ApiProperty({ description: 'Post status', example: 'PUBLISHED' })
  status!: string;

  @ApiProperty({
    description: 'Reaction counts by type',
    example: { LIKE: 5, LOVE: 2 },
  })
  reactionCounts!: Record<string, number>;

  @ApiPropertyOptional({ description: 'Number of comments on this post', example: 3 })
  commentCount?: number;

  @ApiPropertyOptional({
    description: "The viewing user's own reaction type on this post, or null",
    example: 'LIKE',
    nullable: true,
  })
  viewerReaction!: string | null;

  @ApiProperty({ description: 'Post creation timestamp', example: '2024-01-01T00:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ description: 'Post last update timestamp', example: '2024-01-01T00:00:00.000Z' })
  updatedAt!: string;

  public static fromDomain(
    publication: Publication,
    commentCount?: number,
    author?: { displayName?: string; avatarUrl?: string | null },
    viewerReaction: string | null = null,
  ): PostResponseDto {
    const dto = new PostResponseDto();
    dto.id = publication.id.value;
    dto.authorId = publication.authorId.value;
    dto.authorName = author?.displayName ?? 'Member';
    dto.authorAvatarUrl = author?.avatarUrl ?? null;
    dto.content = publication.content.text;
    dto.visibility = publication.visibility.value;
    dto.status = publication.status.value;
    dto.groupId = publication.groupId?.value ?? null;

    const counts: Record<string, number> = {};
    for (const [key, value] of publication.reactionCounts) {
      counts[key] = value;
    }
    dto.reactionCounts = counts;

    dto.commentCount = commentCount;
    dto.viewerReaction = viewerReaction;
    dto.createdAt = publication.createdAt.value.toISOString();
    dto.updatedAt = publication.updatedAt.value.toISOString();
    return dto;
  }
}
