import { Module } from '@nestjs/common';
import { CommunityInfrastructureModule } from '@csn/infra-community';

import { GroupController } from './controllers/group.controller';

// Command handlers
import { CreateGroupHandler } from './commands/create-group.handler';
import { UpdateGroupHandler } from './commands/update-group.handler';
import { DeleteGroupHandler } from './commands/delete-group.handler';
import { JoinGroupHandler } from './commands/join-group.handler';
import { LeaveGroupHandler } from './commands/leave-group.handler';
import { UpdateMemberRoleHandler } from './commands/update-member-role.handler';
import { KickMemberHandler } from './commands/kick-member.handler';

// Query handlers
import { GetGroupHandler } from './queries/get-group.handler';
import { GetGroupMembersHandler } from './queries/get-group-members.handler';
import { SearchGroupsHandler } from './queries/search-groups.handler';

const CommandHandlers = [
  CreateGroupHandler,
  UpdateGroupHandler,
  DeleteGroupHandler,
  JoinGroupHandler,
  LeaveGroupHandler,
  UpdateMemberRoleHandler,
  KickMemberHandler,
];

const QueryHandlers = [
  GetGroupHandler,
  GetGroupMembersHandler,
  SearchGroupsHandler,
];

@Module({
  imports: [CommunityInfrastructureModule],
  controllers: [GroupController],
  providers: [...CommandHandlers, ...QueryHandlers],
  exports: [...CommandHandlers, ...QueryHandlers],
})
export class CommunityModule {}
