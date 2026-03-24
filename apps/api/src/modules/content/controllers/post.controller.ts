import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Public, CurrentUser } from '@csn/infra-auth';
import { AccessTokenPayload } from '@csn/infra-auth';
import { VisibilityEnum } from '@csn/domain-content';
import { CreatePostDto } from '../dto/create-post.dto';
import { UpdatePostDto } from '../dto/update-post.dto';
import { FeedQueryDto } from '../dto/feed-query.dto';
import { PostResponseDto } from '../dto/post-response.dto';
import { CreatePostCommand } from '../commands/create-post.command';
import { CreatePostResult } from '../commands/create-post.handler';
import { UpdatePostCommand } from '../commands/update-post.command';
import { DeletePostCommand } from '../commands/delete-post.command';
import { GetPostQuery } from '../queries/get-post.query';
import { GetFeedQuery } from '../queries/get-feed.query';
import { FeedResult } from '../queries/get-feed.handler';
import { PAGINATION } from '@csn/domain-shared';

@ApiTags('posts')
@Controller()
export class PostController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post('api/posts')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new post' })
  @ApiResponse({ status: 201, description: 'Post created', type: PostResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createPost(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreatePostDto,
  ): Promise<{ id: string }> {
    const command = new CreatePostCommand(
      user.userId,
      dto.content,
      dto.visibility ?? VisibilityEnum.PUBLIC,
    );
    const result = await this.commandBus.execute<CreatePostCommand, CreatePostResult>(command);
    return { id: result.publicationId };
  }

  @Public()
  @Get('api/posts/:id')
  @ApiOperation({ summary: 'Get a post by ID' })
  @ApiResponse({ status: 200, description: 'Post found', type: PostResponseDto })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async getPost(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PostResponseDto> {
    return this.queryBus.execute<GetPostQuery, PostResponseDto>(new GetPostQuery(id));
  }

  @Put('api/posts/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a post (owner only)' })
  @ApiResponse({ status: 200, description: 'Post updated' })
  @ApiResponse({ status: 403, description: 'Forbidden - not the post owner' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async updatePost(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePostDto,
  ): Promise<void> {
    const command = new UpdatePostCommand(id, user.userId, dto.content);
    await this.commandBus.execute(command);
  }

  @Delete('api/posts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a post (owner only)' })
  @ApiResponse({ status: 204, description: 'Post deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden - not the post owner' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async deletePost(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    const command = new DeletePostCommand(id, user.userId);
    await this.commandBus.execute(command);
  }

  @Get('api/feed')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the authenticated user feed (cursor-based pagination)' })
  @ApiResponse({ status: 200, description: 'Feed retrieved' })
  async getFeed(
    @CurrentUser() user: AccessTokenPayload,
    @Query() feedQuery: FeedQueryDto,
  ): Promise<FeedResult> {
    const query = new GetFeedQuery(
      user.userId,
      feedQuery.cursor,
      feedQuery.limit ?? PAGINATION.DEFAULT_PAGE_SIZE,
    );
    return this.queryBus.execute<GetFeedQuery, FeedResult>(query);
  }
}
