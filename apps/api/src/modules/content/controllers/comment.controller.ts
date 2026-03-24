import {
  Controller,
  Get,
  Post,
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
import { GetCommentsQuery } from '../queries/get-comments.query';

@ApiTags('comments')
@Controller()
export class CommentController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post('api/posts/:postId/comments')
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

  @Public()
  @Get('api/posts/:postId/comments')
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
