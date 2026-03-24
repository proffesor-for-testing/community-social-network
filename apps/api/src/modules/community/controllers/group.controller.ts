import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Public, CurrentUser, AccessTokenPayload } from '@csn/infra-auth';

import { CreateGroupDto } from '../dto/create-group.dto';
import { UpdateGroupDto } from '../dto/update-group.dto';
import { UpdateMemberRoleDto } from '../dto/update-member-role.dto';
import { SearchGroupsDto } from '../dto/search-groups.dto';
import { GroupResponseDto } from '../dto/group-response.dto';
import { MembershipResponseDto } from '../dto/membership-response.dto';

import { CreateGroupHandler } from '../commands/create-group.handler';
import { UpdateGroupHandler } from '../commands/update-group.handler';
import { DeleteGroupHandler } from '../commands/delete-group.handler';
import { JoinGroupHandler } from '../commands/join-group.handler';
import { LeaveGroupHandler } from '../commands/leave-group.handler';
import { UpdateMemberRoleHandler } from '../commands/update-member-role.handler';
import { KickMemberHandler } from '../commands/kick-member.handler';

import { GetGroupHandler } from '../queries/get-group.handler';
import { GetGroupMembersHandler } from '../queries/get-group-members.handler';
import { SearchGroupsHandler } from '../queries/search-groups.handler';

import { CreateGroupCommand } from '../commands/create-group.command';
import { UpdateGroupCommand } from '../commands/update-group.command';
import { DeleteGroupCommand } from '../commands/delete-group.command';
import { JoinGroupCommand } from '../commands/join-group.command';
import { LeaveGroupCommand } from '../commands/leave-group.command';
import { UpdateMemberRoleCommand } from '../commands/update-member-role.command';
import { KickMemberCommand } from '../commands/kick-member.command';

import { GetGroupQuery } from '../queries/get-group.query';
import { GetGroupMembersQuery } from '../queries/get-group-members.query';
import { SearchGroupsQuery } from '../queries/search-groups.query';

@Controller('api/groups')
export class GroupController {
  constructor(
    private readonly createGroupHandler: CreateGroupHandler,
    private readonly updateGroupHandler: UpdateGroupHandler,
    private readonly deleteGroupHandler: DeleteGroupHandler,
    private readonly joinGroupHandler: JoinGroupHandler,
    private readonly leaveGroupHandler: LeaveGroupHandler,
    private readonly updateMemberRoleHandler: UpdateMemberRoleHandler,
    private readonly kickMemberHandler: KickMemberHandler,
    private readonly getGroupHandler: GetGroupHandler,
    private readonly getGroupMembersHandler: GetGroupMembersHandler,
    private readonly searchGroupsHandler: SearchGroupsHandler,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createGroup(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateGroupDto,
  ): Promise<GroupResponseDto> {
    const command = new CreateGroupCommand(
      user.userId,
      dto.name,
      dto.description ?? '',
      dto.settings,
    );
    const group = await this.createGroupHandler.execute(command);
    return GroupResponseDto.fromDomain(group);
  }

  @Public()
  @Get('search')
  async searchGroups(
    @Query() dto: SearchGroupsDto,
  ): Promise<{
    items: GroupResponseDto[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const query = new SearchGroupsQuery(
      dto.query ?? '',
      dto.page ?? 1,
      dto.limit ?? 20,
    );
    const result = await this.searchGroupsHandler.execute(query);
    return {
      items: result.items.map(GroupResponseDto.fromDomain),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    };
  }

  @Public()
  @Get(':id')
  async getGroup(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<GroupResponseDto> {
    const query = new GetGroupQuery(id);
    const group = await this.getGroupHandler.execute(query);
    return GroupResponseDto.fromDomain(group);
  }

  @Put(':id')
  async updateGroup(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGroupDto,
  ): Promise<GroupResponseDto> {
    const command = new UpdateGroupCommand(
      user.userId,
      id,
      dto.name,
      dto.description,
      dto.settings,
    );
    const group = await this.updateGroupHandler.execute(command);
    return GroupResponseDto.fromDomain(group);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteGroup(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    const command = new DeleteGroupCommand(user.userId, id);
    await this.deleteGroupHandler.execute(command);
  }

  @Post(':id/join')
  @HttpCode(HttpStatus.CREATED)
  async joinGroup(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MembershipResponseDto> {
    const command = new JoinGroupCommand(user.userId, id);
    const membership = await this.joinGroupHandler.execute(command);
    return MembershipResponseDto.fromDomain(membership);
  }

  @Post(':id/leave')
  @HttpCode(HttpStatus.NO_CONTENT)
  async leaveGroup(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    const command = new LeaveGroupCommand(user.userId, id);
    await this.leaveGroupHandler.execute(command);
  }

  @Public()
  @Get(':id/members')
  async getGroupMembers(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<{
    items: MembershipResponseDto[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const query = new GetGroupMembersQuery(
      id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
    const result = await this.getGroupMembersHandler.execute(query);
    return {
      items: result.items.map(MembershipResponseDto.fromDomain),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    };
  }

  @Put(':id/members/:memberId/role')
  async updateMemberRole(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: UpdateMemberRoleDto,
  ): Promise<MembershipResponseDto> {
    const command = new UpdateMemberRoleCommand(
      user.userId,
      id,
      memberId,
      dto.role,
    );
    const membership = await this.updateMemberRoleHandler.execute(command);
    return MembershipResponseDto.fromDomain(membership);
  }

  @Delete(':id/members/:memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async kickMember(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ): Promise<void> {
    const command = new KickMemberCommand(user.userId, id, memberId);
    await this.kickMemberHandler.execute(command);
  }
}
