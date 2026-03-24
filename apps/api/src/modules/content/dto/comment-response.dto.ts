import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Discussion } from '@csn/domain-content';

export class CommentResponseDto {
  @ApiProperty({ description: 'Comment ID (UUID)', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id!: string;

  @ApiProperty({ description: 'Post ID this comment belongs to', example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901' })
  postId!: string;

  @ApiProperty({ description: 'Author member ID (UUID)', example: 'c3d4e5f6-a7b8-9012-cdef-123456789012' })
  authorId!: string;

  @ApiProperty({ description: 'Comment text content', example: 'Great post!' })
  content!: string;

  @ApiPropertyOptional({ description: 'Parent comment ID for threaded replies (null if top-level)', example: null, nullable: true })
  parentId!: string | null;

  @ApiProperty({ description: 'Nesting depth (0 for top-level)', example: 0 })
  depth!: number;

  @ApiProperty({ description: 'Comment status', example: 'ACTIVE' })
  status!: string;

  @ApiProperty({ description: 'Comment creation timestamp', example: '2024-01-01T00:00:00.000Z' })
  createdAt!: string;

  public static fromDomain(discussion: Discussion, depth: number = 0): CommentResponseDto {
    const dto = new CommentResponseDto();
    dto.id = discussion.id.value;
    dto.postId = discussion.publicationId.value;
    dto.authorId = discussion.authorId.value;
    dto.content = discussion.content.text;
    dto.parentId = discussion.parentId?.value ?? null;
    dto.depth = depth;
    dto.status = discussion.status.value;
    dto.createdAt = discussion.createdAt.value.toISOString();
    return dto;
  }
}
