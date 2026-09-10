import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser, AccessTokenPayload } from '@csn/infra-auth';
import { PAGINATION } from '@csn/domain-shared';
import { CreateGroupPostDto } from '../dto/create-group-post.dto';
import { FeedQueryDto } from '../dto/feed-query.dto';
import { CreateGroupPostCommand } from '../commands/create-group-post.command';
import { CreatePostResult } from '../commands/create-post.handler';
import { GetGroupFeedQuery } from '../queries/get-group-feed.query';
import { FeedResult } from '../queries/get-feed.handler';

/**
 * Group-scoped publications.
 *
 * Lives in the Content module because the Publication aggregate is Content's;
 * group membership is consulted read-only for authorization.
 */
@ApiTags('group-posts')
@Controller()
export class GroupPublicationController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post('api/groups/:groupId/publications')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a post inside a group (members only)' })
  @ApiResponse({ status: 201, description: 'Group post created' })
  @ApiResponse({ status: 403, description: 'Forbidden - not a group member' })
  async createGroupPost(
    @CurrentUser() user: AccessTokenPayload,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: CreateGroupPostDto,
  ): Promise<{ id: string }> {
    const result = await this.commandBus.execute<
      CreateGroupPostCommand,
      CreatePostResult
    >(new CreateGroupPostCommand(groupId, user.userId, dto.content));
    return { id: result.publicationId };
  }

  @Get('api/groups/:groupId/publications')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List a group feed (members only, cursor-paginated)' })
  @ApiResponse({ status: 200, description: 'Group feed retrieved' })
  @ApiResponse({ status: 403, description: 'Forbidden - not a group member' })
  async getGroupFeed(
    @CurrentUser() user: AccessTokenPayload,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Query() feedQuery: FeedQueryDto,
  ): Promise<FeedResult> {
    return this.queryBus.execute<GetGroupFeedQuery, FeedResult>(
      new GetGroupFeedQuery(
        groupId,
        user.userId,
        feedQuery.cursor,
        feedQuery.limit ?? PAGINATION.DEFAULT_PAGE_SIZE,
      ),
    );
  }
}
