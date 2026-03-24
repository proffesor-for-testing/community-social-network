import {
  Controller,
  Post,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '@csn/infra-auth';
import { AccessTokenPayload } from '@csn/infra-auth';
import { ReactDto } from '../dto/react.dto';
import { AddReactionCommand } from '../commands/add-reaction.command';
import { RemoveReactionCommand } from '../commands/remove-reaction.command';

@ApiTags('reactions')
@Controller()
export class ReactionController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('api/posts/:postId/reactions')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a reaction to a post' })
  @ApiResponse({ status: 201, description: 'Reaction added' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async addReactionToPost(
    @CurrentUser() user: AccessTokenPayload,
    @Param('postId', ParseUUIDPipe) postId: string,
    @Body() dto: ReactDto,
  ): Promise<void> {
    const command = new AddReactionCommand(postId, 'post', user.userId, dto.reactionType);
    await this.commandBus.execute(command);
  }

  @Delete('api/posts/:postId/reactions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a reaction from a post' })
  @ApiResponse({ status: 204, description: 'Reaction removed' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async removeReactionFromPost(
    @CurrentUser() user: AccessTokenPayload,
    @Param('postId', ParseUUIDPipe) postId: string,
    @Body() dto: ReactDto,
  ): Promise<void> {
    const command = new RemoveReactionCommand(postId, 'post', user.userId, dto.reactionType);
    await this.commandBus.execute(command);
  }

  @Post('api/comments/:commentId/reactions')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a reaction to a comment' })
  @ApiResponse({ status: 201, description: 'Reaction added to comment' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  async addReactionToComment(
    @CurrentUser() user: AccessTokenPayload,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Body() dto: ReactDto,
  ): Promise<void> {
    const command = new AddReactionCommand(commentId, 'comment', user.userId, dto.reactionType);
    await this.commandBus.execute(command);
  }
}
