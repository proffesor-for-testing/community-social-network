import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Public, CurrentUser } from '@csn/infra-auth';
import { AccessTokenPayload } from '@csn/infra-auth';
import { CreateCommentDto } from '../dto/create-comment.dto';
import { CommentResponseDto } from '../dto/comment-response.dto';
import { CreateCommentCommand } from '../commands/create-comment.command';
import { CreateCommentResult } from '../commands/create-comment.handler';
import { DeleteCommentCommand } from '../commands/delete-comment.command';
import { UpdateCommentCommand } from '../commands/update-comment.command';
import { UpdateCommentDto } from '../dto/update-comment.dto';
import { GetCommentsQuery } from '../queries/get-comments.query';

@ApiTags('comments')
@Controller()
export class CommentController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post('api/publications/:postId/discussions')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a comment on a post' })
  @ApiResponse({ status: 201, description: 'Comment created' })
  @ApiResponse({ status: 404, description: 'Post or parent comment not found' })
  async createComment(
    @CurrentUser() user: AccessTokenPayload,
    @Param('postId', ParseUUIDPipe) postId: string,
    @Body() dto: CreateCommentDto,
  ): Promise<{ id: string }> {
    const command = new CreateCommentCommand(
      postId,
      user.userId,
      dto.content,
      dto.parentCommentId,
    );
    const result = await this.commandBus.execute<CreateCommentCommand, CreateCommentResult>(command);
    return { id: result.commentId };
  }

  @Patch('api/discussions/:commentId')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit a comment (author only)' })
  @ApiResponse({ status: 200, description: 'Comment updated' })
  @ApiResponse({ status: 403, description: 'Not the comment author' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  async updateComment(
    @CurrentUser() user: AccessTokenPayload,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Body() dto: UpdateCommentDto,
  ): Promise<{ ok: true }> {
    await this.commandBus.execute(
      new UpdateCommentCommand(commentId, user.userId, dto.content),
    );
    return { ok: true };
  }

  @Delete('api/discussions/:commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Soft-delete a comment (author only)' })
  @ApiResponse({ status: 204, description: 'Comment deleted' })
  @ApiResponse({ status: 403, description: 'Not the comment author' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  async deleteComment(
    @CurrentUser() user: AccessTokenPayload,
    @Param('commentId', ParseUUIDPipe) commentId: string,
  ): Promise<void> {
    await this.commandBus.execute(new DeleteCommentCommand(commentId, user.userId));
  }

  @Public()
  @Get('api/publications/:postId/discussions')
  @ApiOperation({ summary: 'Get all comments for a post (threaded)' })
  @ApiResponse({ status: 200, description: 'Comments retrieved', type: [CommentResponseDto] })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async getComments(
    @Param('postId', ParseUUIDPipe) postId: string,
  ): Promise<CommentResponseDto[]> {
    return this.queryBus.execute<GetCommentsQuery, CommentResponseDto[]>(
      new GetCommentsQuery(postId),
    );
  }
}
