/**
 * Groups Module - Public API
 * M5 Groups & RBAC
 *
 * Export all public components for the groups module
 */

// Types
export * from './group.types';

// Services
export { GroupService } from './group.service';
export type {
  GroupRepository,
  MemberRepository as GroupMemberRepository,
  RequestRepository,
  PermissionCache,
} from './group.service';

export { RBACService } from './rbac.service';
export type {
  MemberRepository as RBACMemberRepository,
  PermissionCache as RBACPermissionCache,
} from './rbac.service';

export { MembershipService } from './membership.service';
export type {
  MemberRepository,
  RequestRepository as MembershipRequestRepository,
  GroupRepository as MembershipGroupRepository,
  AuditLogger,
} from './membership.service';

// Controller
export { GroupController, AuthenticatedRequest } from './group.controller';

// Routes
export { createGroupRoutes, default as groupRoutes } from './group.routes';
