# M5 Groups & RBAC System - Pseudocode Design
## SPARC Phase 2: Pseudocode

**Document Version:** 1.0.0
**Created:** 2025-12-16
**Status:** ✅ PSEUDOCODE COMPLETE
**Milestone:** M5 - Groups & Communities
**Phase:** SPARC Phase 2 (Pseudocode)

---

## Table of Contents

1. [Overview](#overview)
2. [Data Structures](#data-structures)
3. [RBAC Core Algorithms](#rbac-core-algorithms)
4. [Group Management](#group-management)
5. [Member Management](#member-management)
6. [Moderation System](#moderation-system)
7. [Permission Matrix Implementation](#permission-matrix-implementation)
8. [Complexity Analysis](#complexity-analysis)

---

## Overview

### RBAC Hierarchy

```
Owner (Level 3)
  ↓ inherits all permissions from
Moderator (Level 2)
  ↓ inherits all permissions from
Member (Level 1)
```

**Role Inheritance Rules:**
- Higher roles inherit ALL permissions from lower roles
- Owner can perform any Moderator or Member action
- Moderator can perform any Member action
- Permission elevation requires explicit assignment

### Key Requirements
- **3 Hierarchical Roles:** Owner, Moderator, Member
- **60+ Permission Tests:** Comprehensive RBAC coverage
- **Permission Caching:** Sub-10ms permission checks
- **Audit Logging:** All moderation actions tracked
- **Privacy Enforcement:** Public, Private, Invite-only groups

---

## Data Structures

### Group Structure

```
STRUCTURE: Group
  id: UUID
  name: VARCHAR(255) UNIQUE
  description: TEXT (max 5000 chars)
  privacy: ENUM('public', 'private', 'invite_only')
  status: ENUM('active', 'archived', 'deleted')
  owner_id: UUID (foreign key to users)
  require_post_approval: BOOLEAN (default FALSE)
  require_member_approval: BOOLEAN (default FALSE)
  member_count: INTEGER (denormalized counter)
  post_count: INTEGER (denormalized counter)
  created_at: TIMESTAMP
  updated_at: TIMESTAMP
  deleted_at: TIMESTAMP (nullable)
  archived_at: TIMESTAMP (nullable)

  INDEXES:
    - PRIMARY KEY (id)
    - UNIQUE INDEX (name)
    - INDEX (owner_id)
    - INDEX (privacy, status) -- For discovery
    - INDEX (created_at DESC) -- For sorting
END STRUCTURE

STRUCTURE: GroupMember
  id: UUID
  group_id: UUID (foreign key to groups)
  user_id: UUID (foreign key to users)
  role: ENUM('owner', 'moderator', 'member')
  status: ENUM('active', 'muted', 'banned')
  muted_until: TIMESTAMP (nullable)
  mute_reason: TEXT (nullable)
  banned_until: TIMESTAMP (nullable, NULL = permanent)
  ban_reason: TEXT (required if banned)
  joined_at: TIMESTAMP
  updated_at: TIMESTAMP

  INDEXES:
    - PRIMARY KEY (id)
    - UNIQUE INDEX (group_id, user_id)
    - INDEX (user_id) -- For user's groups
    - INDEX (group_id, role) -- For role lookups
    - INDEX (status) -- For moderation queries
END STRUCTURE

STRUCTURE: MembershipRequest
  id: UUID
  group_id: UUID (foreign key to groups)
  user_id: UUID (foreign key to users)
  status: ENUM('pending', 'approved', 'rejected')
  answers: JSONB (answers to join questions)
  reviewed_by: UUID (foreign key to users, nullable)
  reviewed_at: TIMESTAMP (nullable)
  rejection_reason: TEXT (nullable)
  created_at: TIMESTAMP
  expires_at: TIMESTAMP (30 days from creation)

  INDEXES:
    - PRIMARY KEY (id)
    - UNIQUE INDEX (group_id, user_id, status) WHERE status='pending'
    - INDEX (group_id, status)
    - INDEX (user_id)
END STRUCTURE

STRUCTURE: GroupInvitation
  id: UUID
  group_id: UUID (foreign key to groups)
  inviter_id: UUID (foreign key to users)
  invitee_id: UUID (foreign key to users, nullable for email invites)
  invitee_email: VARCHAR(255) (nullable)
  status: ENUM('pending', 'accepted', 'declined', 'expired')
  created_at: TIMESTAMP
  expires_at: TIMESTAMP (30 days from creation)

  INDEXES:
    - PRIMARY KEY (id)
    - INDEX (group_id, status)
    - INDEX (invitee_id, status)
    - INDEX (invitee_email, status)
END STRUCTURE

STRUCTURE: ModerationLog
  id: UUID
  group_id: UUID (foreign key to groups)
  moderator_id: UUID (foreign key to users)
  action: ENUM('member_removed', 'member_banned', 'member_muted',
               'post_deleted', 'comment_deleted', 'post_approved',
               'post_rejected', 'role_assigned', 'role_revoked')
  target_user_id: UUID (foreign key to users, nullable)
  target_resource_id: UUID (post_id or comment_id, nullable)
  reason: TEXT (required for moderation actions)
  additional_data: JSONB (context-specific data)
  created_at: TIMESTAMP

  INDEXES:
    - PRIMARY KEY (id)
    - INDEX (group_id, created_at DESC)
    - INDEX (moderator_id, created_at DESC)
    - INDEX (target_user_id)
END STRUCTURE

STRUCTURE: PermissionCache (Redis)
  KEY: "perm:{user_id}:{group_id}"
  VALUE: {
    role: STRING,
    permissions: ARRAY of STRING,
    cached_at: TIMESTAMP
  }
  TTL: 300 seconds (5 minutes)
END STRUCTURE
```

---

## RBAC Core Algorithms

### 1. Permission Check (with Caching)

```
ALGORITHM: CheckPermission
INPUT:
  user_id (UUID)
  group_id (UUID)
  action (STRING) -- e.g., "delete_post", "ban_member"
OUTPUT:
  allowed (BOOLEAN)

PRECONDITIONS:
  - User is authenticated
  - Group exists
  - Action is a valid permission string

POSTCONDITIONS:
  - Permission decision is cached for 5 minutes
  - Audit log entry created on denial (for security monitoring)

BEGIN
  // Step 1: Check cache first (fast path)
  cache_key ← "perm:" + user_id + ":" + group_id

  cached_data ← Redis.get(cache_key)

  IF cached_data is NOT NULL THEN
    permissions ← cached_data.permissions

    IF action IN permissions THEN
      RETURN TRUE
    ELSE
      RETURN FALSE
    END IF
  END IF

  // Step 2: Cache miss - query database
  membership ← Database.findOne(group_members, {
    group_id: group_id,
    user_id: user_id
  })

  IF membership is NULL THEN
    RETURN FALSE // Not a member
  END IF

  // Step 3: Check membership status
  IF membership.status = 'banned' THEN
    IF membership.banned_until is NULL OR membership.banned_until > NOW() THEN
      RETURN FALSE // Active ban
    ELSE
      // Ban expired, update status
      Database.update(group_members, {
        id: membership.id,
        status: 'active',
        banned_until: NULL
      })
      membership.status ← 'active'
    END IF
  END IF

  IF membership.status = 'muted' AND action IN ['create_post', 'create_comment'] THEN
    IF membership.muted_until > NOW() THEN
      RETURN FALSE // Active mute prevents posting
    ELSE
      // Mute expired
      Database.update(group_members, {
        id: membership.id,
        status: 'active',
        muted_until: NULL
      })
    END IF
  END IF

  // Step 4: Get role-based permissions
  permissions ← GetRolePermissions(membership.role)

  // Step 5: Check if action is in permissions
  has_permission ← (action IN permissions)

  // Step 6: Apply special rules for member management actions
  IF action IN ['remove_member', 'ban_member', 'mute_member'] THEN
    target_user_id ← GetContextTargetUserId() // From request context

    IF target_user_id is NOT NULL THEN
      target_membership ← Database.findOne(group_members, {
        group_id: group_id,
        user_id: target_user_id
      })

      // Moderators cannot target Owner or other Moderators
      IF membership.role = 'moderator' THEN
        IF target_membership.role IN ['owner', 'moderator'] THEN
          has_permission ← FALSE
        END IF
      END IF

      // No one can target themselves (except leave_group)
      IF user_id = target_user_id THEN
        has_permission ← FALSE
      END IF
    END IF
  END IF

  // Step 7: Check group status
  group ← Database.findGroupById(group_id)

  IF group.status = 'archived' THEN
    // Only allow read actions in archived groups
    IF action NOT IN ['view_group', 'view_members', 'view_posts', 'leave_group'] THEN
      has_permission ← FALSE
    END IF
  END IF

  // Step 8: Cache the result
  Redis.setex(cache_key, 300, {
    role: membership.role,
    permissions: permissions,
    cached_at: NOW()
  })

  // Step 9: Log permission denial (security monitoring)
  IF NOT has_permission THEN
    LogPermissionDenial({
      user_id: user_id,
      group_id: group_id,
      action: action,
      role: membership.role
    })
  END IF

  RETURN has_permission
END

COMPLEXITY: O(1) average with cache, O(log n) worst case on cache miss
SECURITY:
  - Cache prevents database overload
  - Permission denials are logged
  - Expired mutes/bans automatically lifted
  - Special rules prevent privilege escalation
```

---

### 2. Get Role Permissions

```
ALGORITHM: GetRolePermissions
INPUT:
  role (ENUM: 'owner', 'moderator', 'member')
OUTPUT:
  permissions (ARRAY of STRING)

BEGIN
  // Define permission sets (in practice, load from config)
  MEMBER_PERMISSIONS ← [
    'view_group',
    'view_members',
    'view_posts',
    'create_post',
    'edit_own_post',
    'delete_own_post',
    'create_comment',
    'edit_own_comment',
    'delete_own_comment',
    'react_to_content',
    'share_post',
    'report_content',
    'invite_member', // If group allows
    'leave_group',
    'configure_own_notifications'
  ]

  MODERATOR_PERMISSIONS ← MEMBER_PERMISSIONS + [
    'edit_group_description',
    'edit_group_rules',
    'approve_member_requests',
    'reject_member_requests',
    'remove_member', // Except owner/moderators
    'ban_member', // Except owner/moderators
    'unban_member',
    'mute_member', // Except owner/moderators
    'unmute_member',
    'delete_any_post',
    'delete_any_comment',
    'pin_post',
    'unpin_post',
    'approve_post',
    'reject_post',
    'view_reports',
    'action_report',
    'view_moderation_logs'
  ]

  OWNER_PERMISSIONS ← MODERATOR_PERMISSIONS + [
    'edit_group_name',
    'delete_group',
    'archive_group',
    'unarchive_group',
    'transfer_ownership',
    'change_privacy',
    'configure_post_approval',
    'configure_member_approval',
    'configure_join_questions',
    'assign_moderator',
    'revoke_moderator',
    'remove_moderator', // Can remove moderators
    'ban_moderator', // Can ban moderators
    'view_audit_trail',
    'export_group_data',
    'configure_group_notifications'
  ]

  IF role = 'owner' THEN
    RETURN OWNER_PERMISSIONS
  ELSE IF role = 'moderator' THEN
    RETURN MODERATOR_PERMISSIONS
  ELSE IF role = 'member' THEN
    RETURN MEMBER_PERMISSIONS
  ELSE
    RETURN [] // Invalid role
  END IF
END

COMPLEXITY: O(1) - Constant time lookup
NOTE: Permissions can be cached globally (rarely change)
```

---

### 3. Invalidate Permission Cache

```
ALGORITHM: InvalidatePermissionCache
INPUT:
  user_id (UUID)
  group_id (UUID)
OUTPUT:
  void

BEGIN
  cache_key ← "perm:" + user_id + ":" + group_id

  Redis.delete(cache_key)

  // Optional: Invalidate related caches
  // e.g., user's group list, group member count
END

COMPLEXITY: O(1)
WHEN TO CALL:
  - After role assignment/revocation
  - After member removal/ban
  - After group status change (archived, deleted)
```

---

## Group Management

### 4. Create Group

```
ALGORITHM: CreateGroup
INPUT:
  creator_id (UUID)
  name (STRING)
  description (STRING)
  privacy (ENUM: 'public', 'private', 'invite_only')
OUTPUT:
  group (Group object) or error

PRECONDITIONS:
  - User is authenticated
  - User account is verified
  - Name is unique (3-100 characters)
  - Description is 0-5000 characters

POSTCONDITIONS:
  - Group created with status 'active'
  - Creator assigned as Owner
  - Audit log entry created

BEGIN
  // Step 1: Validate name uniqueness
  existing_group ← Database.findOne(groups, {name: name})

  IF existing_group is NOT NULL THEN
    RETURN error("Group name already exists", 409)
  END IF

  // Step 2: Validate input
  IF length(name) < 3 OR length(name) > 100 THEN
    RETURN error("Group name must be 3-100 characters", 400)
  END IF

  IF length(description) > 5000 THEN
    RETURN error("Description too long (max 5000 characters)", 400)
  END IF

  description ← Sanitize(description)

  // Step 3: Check user's group creation limit (optional)
  user_group_count ← Database.count(groups, {
    owner_id: creator_id,
    status: 'active'
  })

  IF user_group_count >= MAX_GROUPS_PER_USER THEN // e.g., 10
    RETURN error("Group creation limit reached", 429)
  END IF

  // Step 4: Create group
  group_id ← GenerateUUID()

  BEGIN TRANSACTION

    group ← Database.insert(groups, {
      id: group_id,
      name: name,
      description: description,
      privacy: privacy,
      status: 'active',
      owner_id: creator_id,
      require_post_approval: FALSE,
      require_member_approval: (privacy ≠ 'public'),
      member_count: 1, // Creator is first member
      post_count: 0,
      created_at: NOW(),
      updated_at: NOW()
    })

    // Step 5: Add creator as owner
    Database.insert(group_members, {
      id: GenerateUUID(),
      group_id: group_id,
      user_id: creator_id,
      role: 'owner',
      status: 'active',
      joined_at: NOW()
    })

  COMMIT TRANSACTION

  // Step 6: Create audit log entry
  LogAuditEvent({
    event_type: 'group_created',
    group_id: group_id,
    actor_id: creator_id,
    actor_role: 'owner',
    additional_data: {
      name: name,
      privacy: privacy
    }
  })

  RETURN group
END

COMPLEXITY: O(1) - All operations use indexes
SECURITY:
  - Name uniqueness prevents impersonation
  - Creation limit prevents spam
  - Input sanitization prevents XSS
```

---

### 5. Transfer Ownership

```
ALGORITHM: TransferOwnership
INPUT:
  group_id (UUID)
  current_owner_id (UUID)
  new_owner_id (UUID)
OUTPUT:
  transfer_request (object) or error

PRECONDITIONS:
  - Current user is the owner
  - New owner is an existing member
  - New owner is not banned

POSTCONDITIONS:
  - Transfer request created (pending acceptance)
  - New owner notified
  - Request expires in 7 days

BEGIN
  // Step 1: Verify current owner
  current_membership ← Database.findOne(group_members, {
    group_id: group_id,
    user_id: current_owner_id,
    role: 'owner'
  })

  IF current_membership is NULL THEN
    RETURN error("Only the owner can transfer ownership", 403)
  END IF

  // Step 2: Verify new owner is a member
  new_member ← Database.findOne(group_members, {
    group_id: group_id,
    user_id: new_owner_id
  })

  IF new_member is NULL THEN
    RETURN error("User must be a member to receive ownership", 400)
  END IF

  IF new_member.status = 'banned' THEN
    RETURN error("Cannot transfer ownership to banned member", 400)
  END IF

  // Step 3: Check for existing pending transfer
  existing_transfer ← Database.findOne(ownership_transfers, {
    group_id: group_id,
    status: 'pending'
  })

  IF existing_transfer is NOT NULL THEN
    RETURN error("A transfer request is already pending", 409)
  END IF

  // Step 4: Create transfer request
  transfer_request ← Database.insert(ownership_transfers, {
    id: GenerateUUID(),
    group_id: group_id,
    from_user_id: current_owner_id,
    to_user_id: new_owner_id,
    status: 'pending',
    created_at: NOW(),
    expires_at: NOW() + 7 days
  })

  // Step 5: Notify new owner
  CreateNotification({
    type: 'ownership_transfer_request',
    recipient_id: new_owner_id,
    actor_id: current_owner_id,
    group_id: group_id
  })

  // Step 6: Log action
  LogAuditEvent({
    event_type: 'ownership_transfer_initiated',
    group_id: group_id,
    actor_id: current_owner_id,
    target_user_id: new_owner_id
  })

  RETURN transfer_request
END

COMPLEXITY: O(1)
```

---

### 6. Accept Ownership Transfer

```
ALGORITHM: AcceptOwnershipTransfer
INPUT:
  transfer_id (UUID)
  accepting_user_id (UUID)
OUTPUT:
  success (BOOLEAN) or error

PRECONDITIONS:
  - Transfer request exists and is pending
  - Accepting user is the designated new owner
  - Transfer has not expired

POSTCONDITIONS:
  - Roles swapped: new owner becomes 'owner', old owner becomes 'moderator'
  - All members notified
  - Permission caches invalidated

BEGIN
  // Step 1: Load transfer request
  transfer ← Database.findOne(ownership_transfers, {
    id: transfer_id,
    status: 'pending'
  })

  IF transfer is NULL THEN
    RETURN error("Transfer request not found", 404)
  END IF

  IF transfer.expires_at < NOW() THEN
    Database.update(ownership_transfers, {
      id: transfer_id,
      status: 'expired'
    })
    RETURN error("Transfer request has expired", 410)
  END IF

  // Step 2: Verify accepting user
  IF transfer.to_user_id ≠ accepting_user_id THEN
    RETURN error("You are not the designated new owner", 403)
  END IF

  BEGIN TRANSACTION

    // Step 3: Update old owner to moderator
    Database.update(group_members, {
      group_id: transfer.group_id,
      user_id: transfer.from_user_id,
      role: 'moderator',
      updated_at: NOW()
    })

    // Step 4: Update new owner to owner role
    Database.update(group_members, {
      group_id: transfer.group_id,
      user_id: transfer.to_user_id,
      role: 'owner',
      updated_at: NOW()
    })

    // Step 5: Update group owner_id
    Database.update(groups, {
      id: transfer.group_id,
      owner_id: transfer.to_user_id,
      updated_at: NOW()
    })

    // Step 6: Mark transfer as accepted
    Database.update(ownership_transfers, {
      id: transfer_id,
      status: 'accepted',
      accepted_at: NOW()
    })

  COMMIT TRANSACTION

  // Step 7: Invalidate permission caches
  InvalidatePermissionCache(transfer.from_user_id, transfer.group_id)
  InvalidatePermissionCache(transfer.to_user_id, transfer.group_id)

  // Step 8: Notify all members
  NotifyGroupMembers({
    group_id: transfer.group_id,
    type: 'ownership_transferred',
    old_owner_id: transfer.from_user_id,
    new_owner_id: transfer.to_user_id
  })

  // Step 9: Log audit event
  LogAuditEvent({
    event_type: 'ownership_transferred',
    group_id: transfer.group_id,
    actor_id: transfer.to_user_id,
    additional_data: {
      previous_owner: transfer.from_user_id,
      new_owner: transfer.to_user_id
    }
  })

  RETURN success
END

COMPLEXITY: O(1) for role updates, O(m) for member notifications (m = member count)
```

---

## Member Management

### 7. Invite Member

```
ALGORITHM: InviteMember
INPUT:
  group_id (UUID)
  inviter_id (UUID)
  invitee_email (STRING) or invitee_id (UUID)
OUTPUT:
  invitation (GroupInvitation) or error

PRECONDITIONS:
  - Inviter has 'invite_member' permission
  - Invitee is not already a member
  - Invitee is not banned
  - Group has not reached member limit

POSTCONDITIONS:
  - Invitation created with 30-day expiry
  - Invitee notified via email or in-app
  - Invitation can be accepted or declined

BEGIN
  // Step 1: Check inviter permission
  has_permission ← CheckPermission(inviter_id, group_id, 'invite_member')

  IF NOT has_permission THEN
    RETURN error("Insufficient permissions to invite members", 403)
  END IF

  // Step 2: Resolve invitee
  IF invitee_id is NOT NULL THEN
    invitee ← Database.findUserById(invitee_id)
    invitee_email ← invitee.email
  ELSE
    // External email invite
    invitee ← Database.findUserByEmail(invitee_email)
    IF invitee is NOT NULL THEN
      invitee_id ← invitee.id
    END IF
  END IF

  // Step 3: Check if already a member
  IF invitee_id is NOT NULL THEN
    existing_member ← Database.findOne(group_members, {
      group_id: group_id,
      user_id: invitee_id
    })

    IF existing_member is NOT NULL THEN
      IF existing_member.status = 'banned' THEN
        RETURN error("This user is banned from the group", 400)
      ELSE
        RETURN error("User is already a member", 409)
      END IF
    END IF
  END IF

  // Step 4: Check for existing invitation
  existing_invite ← Database.findOne(group_invitations, {
    group_id: group_id,
    invitee_email: invitee_email,
    status: 'pending'
  })

  IF existing_invite is NOT NULL THEN
    RETURN error("An invitation is already pending", 409)
  END IF

  // Step 5: Create invitation
  invitation ← Database.insert(group_invitations, {
    id: GenerateUUID(),
    group_id: group_id,
    inviter_id: inviter_id,
    invitee_id: invitee_id,
    invitee_email: invitee_email,
    status: 'pending',
    created_at: NOW(),
    expires_at: NOW() + 30 days
  })

  // Step 6: Send notification
  IF invitee_id is NOT NULL THEN
    CreateNotification({
      type: 'group_invitation',
      recipient_id: invitee_id,
      actor_id: inviter_id,
      group_id: group_id
    })
  ELSE
    SendEmail({
      to: invitee_email,
      subject: "You've been invited to join a group",
      template: 'group_invitation',
      data: {
        group_name: group.name,
        inviter_name: inviter.display_name,
        invitation_id: invitation.id
      }
    })
  END IF

  // Step 7: Log action
  LogAuditEvent({
    event_type: 'member_invited',
    group_id: group_id,
    actor_id: inviter_id,
    additional_data: {
      invitee_email: invitee_email
    }
  })

  RETURN invitation
END

COMPLEXITY: O(1)
```

---

### 8. Approve Membership Request

```
ALGORITHM: ApproveMembershipRequest
INPUT:
  request_id (UUID)
  approver_id (UUID)
OUTPUT:
  membership (GroupMember) or error

PRECONDITIONS:
  - Approver is owner or moderator
  - Request is pending
  - Request has not expired

POSTCONDITIONS:
  - User added as member
  - Group member_count incremented
  - Request marked as approved
  - Applicant notified

BEGIN
  // Step 1: Load request
  request ← Database.findOne(membership_requests, {
    id: request_id,
    status: 'pending'
  })

  IF request is NULL THEN
    RETURN error("Membership request not found", 404)
  END IF

  IF request.expires_at < NOW() THEN
    Database.update(membership_requests, {
      id: request_id,
      status: 'expired'
    })
    RETURN error("Request has expired", 410)
  END IF

  // Step 2: Check approver permission
  has_permission ← CheckPermission(approver_id, request.group_id, 'approve_member_requests')

  IF NOT has_permission THEN
    RETURN error("Insufficient permissions", 403)
  END IF

  // Step 3: Check if user is banned
  banned_member ← Database.findOne(group_members, {
    group_id: request.group_id,
    user_id: request.user_id,
    status: 'banned'
  })

  IF banned_member is NOT NULL THEN
    RETURN error("User is banned from this group", 400)
  END IF

  BEGIN TRANSACTION

    // Step 4: Add user as member
    membership ← Database.insert(group_members, {
      id: GenerateUUID(),
      group_id: request.group_id,
      user_id: request.user_id,
      role: 'member',
      status: 'active',
      joined_at: NOW()
    })

    // Step 5: Update request status
    Database.update(membership_requests, {
      id: request_id,
      status: 'approved',
      reviewed_by: approver_id,
      reviewed_at: NOW()
    })

    // Step 6: Increment group member count
    Database.execute(
      "UPDATE groups SET member_count = member_count + 1
       WHERE id = ?",
      [request.group_id]
    )

  COMMIT TRANSACTION

  // Step 7: Notify applicant
  CreateNotification({
    type: 'membership_approved',
    recipient_id: request.user_id,
    actor_id: approver_id,
    group_id: request.group_id
  })

  // Step 8: Log action
  LogAuditEvent({
    event_type: 'member_approved',
    group_id: request.group_id,
    actor_id: approver_id,
    target_user_id: request.user_id
  })

  RETURN membership
END

COMPLEXITY: O(1)
```

---

### 9. Remove Member

```
ALGORITHM: RemoveMember
INPUT:
  group_id (UUID)
  remover_id (UUID)
  target_user_id (UUID)
  reason (STRING)
OUTPUT:
  success (BOOLEAN) or error

PRECONDITIONS:
  - Remover has 'remove_member' permission
  - Target is a member
  - Target is not the owner
  - If remover is moderator, target is not moderator

POSTCONDITIONS:
  - Target membership deleted
  - Group member_count decremented
  - Target loses group access immediately
  - Target's content remains in group
  - Action logged

BEGIN
  // Step 1: Check permission
  has_permission ← CheckPermission(remover_id, group_id, 'remove_member')

  IF NOT has_permission THEN
    RETURN error("Insufficient permissions", 403)
  END IF

  // Step 2: Load memberships
  remover_membership ← Database.findOne(group_members, {
    group_id: group_id,
    user_id: remover_id
  })

  target_membership ← Database.findOne(group_members, {
    group_id: group_id,
    user_id: target_user_id
  })

  IF target_membership is NULL THEN
    RETURN error("User is not a member", 404)
  END IF

  // Step 3: Prevent removing owner
  IF target_membership.role = 'owner' THEN
    RETURN error("Cannot remove the group owner", 403)
  END IF

  // Step 4: Moderators cannot remove other moderators
  IF remover_membership.role = 'moderator' THEN
    IF target_membership.role = 'moderator' THEN
      RETURN error("Moderators cannot remove other moderators", 403)
    END IF
  END IF

  // Step 5: Prevent self-removal (use leave_group instead)
  IF remover_id = target_user_id THEN
    RETURN error("Use 'Leave Group' to remove yourself", 400)
  END IF

  BEGIN TRANSACTION

    // Step 6: Delete membership
    Database.delete(group_members, {id: target_membership.id})

    // Step 7: Decrement member count
    Database.execute(
      "UPDATE groups SET member_count = member_count - 1
       WHERE id = ? AND member_count > 0",
      [group_id]
    )

  COMMIT TRANSACTION

  // Step 8: Invalidate target's permission cache
  InvalidatePermissionCache(target_user_id, group_id)

  // Step 9: Notify target (optional)
  CreateNotification({
    type: 'removed_from_group',
    recipient_id: target_user_id,
    actor_id: remover_id,
    group_id: group_id
  })

  // Step 10: Log moderation action
  LogModerationAction({
    group_id: group_id,
    moderator_id: remover_id,
    action: 'member_removed',
    target_user_id: target_user_id,
    reason: reason
  })

  RETURN success
END

COMPLEXITY: O(1)
SECURITY:
  - Role checks prevent privilege escalation
  - Owner cannot be removed
  - Moderators cannot remove each other
```

---

### 10. Ban Member

```
ALGORITHM: BanMember
INPUT:
  group_id (UUID)
  banner_id (UUID)
  target_user_id (UUID)
  reason (STRING)
  duration (INTEGER, nullable) -- Minutes, NULL = permanent
OUTPUT:
  success (BOOLEAN) or error

PRECONDITIONS:
  - Banner has 'ban_member' permission
  - Target is a member
  - Target is not owner (if banner is moderator)
  - Reason is provided

POSTCONDITIONS:
  - Target membership status set to 'banned'
  - Target loses all group access
  - Ban auto-expires after duration (if temporary)
  - Target cannot rejoin unless unbanned

BEGIN
  // Step 1: Validate reason
  IF length(reason) < 3 THEN
    RETURN error("Ban reason is required (min 3 characters)", 400)
  END IF

  // Step 2: Check permission
  has_permission ← CheckPermission(banner_id, group_id, 'ban_member')

  IF NOT has_permission THEN
    RETURN error("Insufficient permissions", 403)
  END IF

  // Step 3: Load memberships
  banner_membership ← Database.findOne(group_members, {
    group_id: group_id,
    user_id: banner_id
  })

  target_membership ← Database.findOne(group_members, {
    group_id: group_id,
    user_id: target_user_id
  })

  IF target_membership is NULL THEN
    RETURN error("User is not a member", 404)
  END IF

  // Step 4: Role-based restrictions
  IF target_membership.role = 'owner' THEN
    RETURN error("Cannot ban the group owner", 403)
  END IF

  IF banner_membership.role = 'moderator' THEN
    IF target_membership.role = 'moderator' THEN
      RETURN error("Moderators cannot ban other moderators", 403)
    END IF
  END IF

  // Step 5: Prevent self-ban
  IF banner_id = target_user_id THEN
    RETURN error("You cannot ban yourself", 400)
  END IF

  // Step 6: Calculate ban expiry
  IF duration is NULL THEN
    banned_until ← NULL // Permanent ban
  ELSE
    banned_until ← NOW() + duration minutes
  END IF

  BEGIN TRANSACTION

    // Step 7: Update membership status
    Database.update(group_members, {
      id: target_membership.id,
      status: 'banned',
      banned_until: banned_until,
      ban_reason: reason,
      updated_at: NOW()
    })

  COMMIT TRANSACTION

  // Step 8: Invalidate permission cache
  InvalidatePermissionCache(target_user_id, group_id)

  // Step 9: Notify target
  CreateNotification({
    type: 'banned_from_group',
    recipient_id: target_user_id,
    group_id: group_id,
    additional_data: {
      reason: reason,
      duration: duration,
      permanent: (duration is NULL)
    }
  })

  // Step 10: Log moderation action
  LogModerationAction({
    group_id: group_id,
    moderator_id: banner_id,
    action: 'member_banned',
    target_user_id: target_user_id,
    reason: reason,
    additional_data: {
      banned_until: banned_until,
      permanent: (duration is NULL)
    }
  })

  RETURN success
END

COMPLEXITY: O(1)
NOTE: Banned members cannot be invited or approved until unbanned
```

---

## Moderation System

### 11. Mute Member

```
ALGORITHM: MuteMember
INPUT:
  group_id (UUID)
  muter_id (UUID)
  target_user_id (UUID)
  reason (STRING)
  duration (INTEGER) -- Minutes (1 hour to 30 days)
OUTPUT:
  success (BOOLEAN) or error

PRECONDITIONS:
  - Muter has 'mute_member' permission
  - Target is a member
  - Duration is between 60 and 43200 minutes (1 hour to 30 days)

POSTCONDITIONS:
  - Target cannot post or comment during mute
  - Target can still view content
  - Mute auto-expires after duration

BEGIN
  // Step 1: Validate duration
  IF duration < 60 OR duration > 43200 THEN
    RETURN error("Mute duration must be 1 hour to 30 days", 400)
  END IF

  // Step 2: Check permission (similar to ban)
  has_permission ← CheckPermission(muter_id, group_id, 'mute_member')

  IF NOT has_permission THEN
    RETURN error("Insufficient permissions", 403)
  END IF

  // Step 3: Load memberships and validate
  muter_membership ← Database.findOne(group_members, {
    group_id: group_id,
    user_id: muter_id
  })

  target_membership ← Database.findOne(group_members, {
    group_id: group_id,
    user_id: target_user_id
  })

  IF target_membership is NULL THEN
    RETURN error("User is not a member", 404)
  END IF

  // Step 4: Role-based restrictions
  IF target_membership.role = 'owner' THEN
    RETURN error("Cannot mute the group owner", 403)
  END IF

  IF muter_membership.role = 'moderator' THEN
    IF target_membership.role IN ['owner', 'moderator'] THEN
      RETURN error("Moderators cannot mute owner or other moderators", 403)
    END IF
  END IF

  IF muter_id = target_user_id THEN
    RETURN error("You cannot mute yourself", 400)
  END IF

  // Step 5: Calculate mute expiry
  muted_until ← NOW() + duration minutes

  BEGIN TRANSACTION

    // Step 6: Update membership
    Database.update(group_members, {
      id: target_membership.id,
      status: 'muted',
      muted_until: muted_until,
      mute_reason: reason,
      updated_at: NOW()
    })

  COMMIT TRANSACTION

  // Step 7: Invalidate cache
  InvalidatePermissionCache(target_user_id, group_id)

  // Step 8: Notify target
  CreateNotification({
    type: 'muted_in_group',
    recipient_id: target_user_id,
    group_id: group_id,
    additional_data: {
      reason: reason,
      muted_until: muted_until,
      duration_minutes: duration
    }
  })

  // Step 9: Log action
  LogModerationAction({
    group_id: group_id,
    moderator_id: muter_id,
    action: 'member_muted',
    target_user_id: target_user_id,
    reason: reason,
    additional_data: {
      muted_until: muted_until,
      duration_minutes: duration
    }
  })

  RETURN success
END

COMPLEXITY: O(1)
NOTE: Muted users see notification explaining mute when attempting to post
```

---

### 12. Assign Moderator Role

```
ALGORITHM: AssignModeratorRole
INPUT:
  group_id (UUID)
  owner_id (UUID)
  target_user_id (UUID)
OUTPUT:
  role_assignment_request (object) or error

PRECONDITIONS:
  - Assigner is the owner
  - Target is an existing member
  - Target is not banned

POSTCONDITIONS:
  - Role assignment request created
  - Target notified to accept/decline
  - Request pending until accepted

BEGIN
  // Step 1: Verify owner permission
  owner_membership ← Database.findOne(group_members, {
    group_id: group_id,
    user_id: owner_id,
    role: 'owner'
  })

  IF owner_membership is NULL THEN
    RETURN error("Only the owner can assign moderators", 403)
  END IF

  // Step 2: Verify target is a member
  target_membership ← Database.findOne(group_members, {
    group_id: group_id,
    user_id: target_user_id
  })

  IF target_membership is NULL THEN
    RETURN error("User must be a member first", 400)
  END IF

  IF target_membership.status = 'banned' THEN
    RETURN error("Cannot assign moderator role to banned member", 400)
  END IF

  IF target_membership.role = 'moderator' THEN
    RETURN error("User is already a moderator", 409)
  END IF

  // Step 3: Create role assignment request
  request ← Database.insert(role_assignments, {
    id: GenerateUUID(),
    group_id: group_id,
    from_user_id: owner_id,
    to_user_id: target_user_id,
    role: 'moderator',
    status: 'pending',
    created_at: NOW()
  })

  // Step 4: Notify target
  CreateNotification({
    type: 'moderator_role_offered',
    recipient_id: target_user_id,
    actor_id: owner_id,
    group_id: group_id
  })

  // Step 5: Log action
  LogAuditEvent({
    event_type: 'moderator_role_offered',
    group_id: group_id,
    actor_id: owner_id,
    target_user_id: target_user_id
  })

  RETURN request
END

COMPLEXITY: O(1)
```

---

### 13. Accept Moderator Role

```
ALGORITHM: AcceptModeratorRole
INPUT:
  request_id (UUID)
  accepting_user_id (UUID)
OUTPUT:
  success (BOOLEAN) or error

PRECONDITIONS:
  - Request is pending
  - Accepting user is the target

POSTCONDITIONS:
  - Target role upgraded to 'moderator'
  - Permission cache invalidated
  - Owner notified of acceptance

BEGIN
  // Step 1: Load request
  request ← Database.findOne(role_assignments, {
    id: request_id,
    status: 'pending'
  })

  IF request is NULL THEN
    RETURN error("Role assignment request not found", 404)
  END IF

  IF request.to_user_id ≠ accepting_user_id THEN
    RETURN error("You are not the designated recipient", 403)
  END IF

  BEGIN TRANSACTION

    // Step 2: Update member role
    Database.update(group_members, {
      group_id: request.group_id,
      user_id: accepting_user_id,
      role: 'moderator',
      updated_at: NOW()
    })

    // Step 3: Mark request as accepted
    Database.update(role_assignments, {
      id: request_id,
      status: 'accepted',
      accepted_at: NOW()
    })

  COMMIT TRANSACTION

  // Step 4: Invalidate cache
  InvalidatePermissionCache(accepting_user_id, request.group_id)

  // Step 5: Notify owner
  CreateNotification({
    type: 'moderator_role_accepted',
    recipient_id: request.from_user_id,
    actor_id: accepting_user_id,
    group_id: request.group_id
  })

  // Step 6: Log action
  LogAuditEvent({
    event_type: 'moderator_assigned',
    group_id: request.group_id,
    actor_id: accepting_user_id,
    additional_data: {
      assigned_by: request.from_user_id
    }
  })

  RETURN success
END

COMPLEXITY: O(1)
```

---

## Permission Matrix Implementation

### 14. Permission Matrix Lookup

```
CONSTANT: PERMISSION_MATRIX

// Maps action to required roles
PERMISSION_MATRIX ← {
  // Group Management
  'create_group': ['owner', 'moderator', 'member'], // Any authenticated user
  'edit_group_name': ['owner'],
  'edit_group_description': ['owner', 'moderator'],
  'edit_group_rules': ['owner', 'moderator'],
  'delete_group': ['owner'],
  'archive_group': ['owner'],
  'unarchive_group': ['owner'],
  'transfer_ownership': ['owner'],
  'export_group_data': ['owner'],

  // Privacy Settings
  'change_privacy': ['owner'],
  'configure_post_approval': ['owner'],
  'configure_member_approval': ['owner'],
  'configure_join_questions': ['owner'],

  // Member Management
  'view_members': ['owner', 'moderator', 'member'],
  'invite_member': ['owner', 'moderator', 'member'], // Check settings
  'approve_member_requests': ['owner', 'moderator'],
  'reject_member_requests': ['owner', 'moderator'],
  'remove_member': ['owner', 'moderator'], // Special rules apply
  'ban_member': ['owner', 'moderator'], // Special rules apply
  'unban_member': ['owner', 'moderator'],
  'mute_member': ['owner', 'moderator'], // Special rules apply
  'unmute_member': ['owner', 'moderator'],
  'assign_moderator': ['owner'],
  'revoke_moderator': ['owner'],
  'leave_group': ['member', 'moderator'], // Not owner

  // Content Management
  'create_post': ['owner', 'moderator', 'member'],
  'edit_own_post': ['owner', 'moderator', 'member'],
  'delete_own_post': ['owner', 'moderator', 'member'],
  'edit_any_post': ['owner', 'moderator'],
  'delete_any_post': ['owner', 'moderator'],
  'pin_post': ['owner', 'moderator'],
  'unpin_post': ['owner', 'moderator'],
  'create_comment': ['owner', 'moderator', 'member'],
  'edit_own_comment': ['owner', 'moderator', 'member'],
  'delete_own_comment': ['owner', 'moderator', 'member'],
  'delete_any_comment': ['owner', 'moderator'],
  'react_to_content': ['owner', 'moderator', 'member'],
  'share_post': ['owner', 'moderator', 'member'],

  // Moderation
  'approve_post': ['owner', 'moderator'],
  'reject_post': ['owner', 'moderator'],
  'view_reports': ['owner', 'moderator'],
  'action_report': ['owner', 'moderator'],
  'report_content': ['owner', 'moderator', 'member'],
  'view_moderation_logs': ['owner', 'moderator'],
  'view_audit_trail': ['owner'],

  // Notifications
  'configure_own_notifications': ['owner', 'moderator', 'member'],
  'configure_group_notifications': ['owner']
}

ALGORITHM: HasPermission
INPUT:
  role (STRING)
  action (STRING)
OUTPUT:
  allowed (BOOLEAN)

BEGIN
  allowed_roles ← PERMISSION_MATRIX[action]

  IF allowed_roles is NULL THEN
    RETURN FALSE // Unknown action
  END IF

  RETURN (role IN allowed_roles)
END

COMPLEXITY: O(1) - Hash map lookup
```

---

## Complexity Analysis

### Time Complexity Summary

| Operation | Best Case | Average Case | Worst Case | Notes |
|-----------|-----------|--------------|------------|-------|
| CheckPermission (cached) | O(1) | O(1) | O(1) | Redis cache hit |
| CheckPermission (uncached) | O(log n) | O(log n) | O(log n) | DB query with index |
| CreateGroup | O(1) | O(1) | O(1) | Simple inserts |
| TransferOwnership | O(1) | O(1) | O(1) | Create request |
| ApproveMembership | O(1) | O(1) | O(1) | Insert + counter update |
| RemoveMember | O(1) | O(1) | O(1) | Delete + counter update |
| BanMember | O(1) | O(1) | O(1) | Status update |
| MuteMember | O(1) | O(1) | O(1) | Status update |
| AssignModerator | O(1) | O(1) | O(1) | Create request |

### Space Complexity

| Data Structure | Space | Notes |
|----------------|-------|-------|
| Group | O(1) | Fixed size per group |
| GroupMember | O(m) | m = total members |
| PermissionCache | O(u * g) | u = users, g = groups (limited by TTL) |
| ModerationLog | O(l) | l = total actions (archived periodically) |

### Cache Strategy

**Permission Cache (Redis):**
- **Key:** `perm:{user_id}:{group_id}`
- **TTL:** 300 seconds (5 minutes)
- **Invalidation:** On role change, ban, mute, group status change
- **Hit Rate Target:** >95%
- **Fallback:** Direct DB query

**Cache Warming:**
```
ALGORITHM: WarmPermissionCache
INPUT: user_id (UUID)
OUTPUT: void

BEGIN
  user_groups ← Database.query(
    "SELECT group_id, role FROM group_members
     WHERE user_id = ? AND status = 'active'",
    [user_id]
  )

  FOR EACH membership IN user_groups DO
    permissions ← GetRolePermissions(membership.role)

    cache_key ← "perm:" + user_id + ":" + membership.group_id

    Redis.setex(cache_key, 300, {
      role: membership.role,
      permissions: permissions,
      cached_at: NOW()
    })
  END FOR
END
```

---

## Security Considerations

### Authorization Enforcement

**Defense in Depth:**
1. **Middleware:** Check permission before handler execution
2. **Handler:** Verify permission again in handler logic
3. **Database:** Use row-level security policies (if supported)

**Permission Bypass Prevention:**
```
NEVER:
  - Trust client-sent role claims
  - Skip permission checks for "trusted" users
  - Use role from JWT without DB verification

ALWAYS:
  - Query current role from database
  - Check permissions on every request
  - Log permission denials
  - Validate target user restrictions
```

### Audit Logging

**What to Log:**
- All moderation actions (ban, mute, remove, delete)
- Role changes (assign, revoke, transfer)
- Group settings changes
- Permission denials (suspicious activity)

**Log Retention:**
- Moderation logs: 2 years minimum
- Audit trail: 7 years (compliance)
- Permission denials: 90 days

**Log Format:**
```json
{
  "event_id": "uuid",
  "event_type": "member_banned",
  "timestamp": "2025-12-16T10:30:00Z",
  "group_id": "uuid",
  "actor_id": "uuid",
  "actor_role": "moderator",
  "target_user_id": "uuid",
  "reason": "Spam posting",
  "additional_data": {
    "banned_until": null,
    "permanent": true
  },
  "ip_address": "192.168.1.100",
  "user_agent": "Mozilla/5.0..."
}
```

### Rate Limiting

**Action Limits:**
```
- Create group: 5 per hour per user
- Invite member: 20 per hour per user
- Ban member: 10 per hour per moderator
- Remove member: 20 per hour per moderator
- Approve requests: 50 per hour per moderator
```

---

## Edge Cases & Error Handling

### Role Transition Edge Cases

**Case 1: Owner leaves without transferring**
```
WHEN: Owner tries to leave group
THEN: Return 400 "Transfer ownership before leaving"
OFFER: UI shows "Transfer Ownership" flow
```

**Case 2: Moderator demoted during action**
```
WHEN: Moderator's role revoked while performing moderation
THEN: Current action completes (transaction committed)
THEN: Next action fails permission check
SOLUTION: Permission checked at transaction start
```

**Case 3: Concurrent role changes**
```
WHEN: Two moderators assigned simultaneously
THEN: Both succeed (no conflict)
WHEN: Role revoked and action attempted simultaneously
THEN: Transaction isolation prevents race condition
```

### Membership Edge Cases

**Case 1: User banned and invited simultaneously**
```
WHEN: Moderator bans while owner invites
THEN: Ban takes precedence (check on invite acceptance)
SOLUTION: Check ban status when accepting invitation
```

**Case 2: Membership request while banned**
```
WHEN: Banned user requests to rejoin
THEN: Return 403 "You are banned from this group"
CHECK: Ban status before allowing request creation
```

**Case 3: Invitation expires during acceptance**
```
WHEN: User accepts invitation after 30 days
THEN: Return 410 "Invitation has expired"
CHECK: Expiry timestamp before processing acceptance
```

### Moderation Edge Cases

**Case 1: Mute/ban expired but cache not invalidated**
```
SOLUTION: CheckPermission verifies expiry timestamp
ACTION: Auto-update status if expired
RESULT: User regains access immediately
```

**Case 2: Moderator tries to mute owner**
```
VALIDATION: Check target role before applying mute
RESULT: Return 403 "Cannot mute the group owner"
```

**Case 3: User deleted during ban**
```
WHEN: User account deleted
THEN: Membership record remains (foreign key preserved)
QUERY: LEFT JOIN users to handle deleted accounts
DISPLAY: Show "[deleted user]" in logs
```

---

## Performance Benchmarks

### Target Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Permission Check (cached) | p95 < 10ms | Redis lookup |
| Permission Check (uncached) | p95 < 50ms | DB query + cache write |
| Approve Membership | p95 < 200ms | DB transaction |
| Ban Member | p95 < 150ms | Status update + cache invalidation |
| Load Group Feed (100 posts) | p95 < 1000ms | With permission filtering |

### Load Testing Scenarios

**Scenario 1: Permission check storm**
```
Given: 10,000 concurrent users
When: Each checks permission 10 times per second
Then: Average latency < 15ms
And: Cache hit rate > 95%
And: No cache stampede on misses
```

**Scenario 2: Mass member approval**
```
Given: 1,000 pending membership requests
When: Moderator approves all in batch
Then: All processed within 30 seconds
And: Member counts accurate
And: All notifications delivered
```

**Scenario 3: Role transition stress test**
```
Given: Group with 1,000 members
When: Owner transferred to new user
Then: Role update completes in <1 second
And: All caches invalidated
And: New owner has immediate access
And: Old owner has moderator access
```

---

**END OF M5 GROUPS & RBAC PSEUDOCODE**
