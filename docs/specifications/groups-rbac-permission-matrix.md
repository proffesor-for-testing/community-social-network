# Groups RBAC Permission Matrix Specification

**Document Version:** 1.0.0
**Last Updated:** 2025-12-04
**Status:** Draft
**Priority:** CRITICAL
**Milestone:** 5 - Groups & Communities

## Executive Summary

This document defines the complete Role-Based Access Control (RBAC) permission matrix for the Community Social Network Groups feature. It addresses the CRITICAL validation issue #1 by establishing a comprehensive three-tier role hierarchy (Owner, Moderator, Member) with detailed permissions, constraints, and test scenarios.

**Key Deliverables:**
- 3 hierarchical roles with inheritance rules
- 60+ permission test scenarios
- Complete permission matrix covering all group actions
- API authorization mapping with HTTP status codes
- Edge case handling and audit requirements

**Security Impact:** This specification prevents permission bypass vulnerabilities and unauthorized group access by establishing clear authorization boundaries and comprehensive test coverage.

---

## Table of Contents

1. [Role Definitions](#role-definitions)
2. [Permission Matrix](#permission-matrix)
3. [Permission Rules](#permission-rules)
4. [Test Scenarios](#test-scenarios)
5. [API Authorization Rules](#api-authorization-rules)
6. [Audit Requirements](#audit-requirements)
7. [Implementation Guidelines](#implementation-guidelines)

---

## 1. Role Definitions

### 1.1 Role Hierarchy

```
Owner (Level 3)
  ↓ inherits all permissions from
Moderator (Level 2)
  ↓ inherits all permissions from
Member (Level 1)
```

**Inheritance Rules:**
- Each role inherits ALL permissions from lower-level roles
- Higher-level roles can perform any action available to lower-level roles
- Role elevation requires explicit assignment
- Role demotion requires explicit revocation

---

### 1.2 Owner Role

**Description:** The creator and ultimate authority of the group with full control over all aspects.

**Hierarchy Level:** 3 (Highest)

**Inherits From:** Moderator (Level 2)

**Default Permissions:**
- ALL Moderator permissions
- Transfer group ownership
- Delete group permanently
- Assign/revoke moderator roles
- Change group privacy settings
- Archive/unarchive group
- Export group data
- Manage group integrations

**Limitations:**
- Cannot remove themselves unless transferring ownership first
- Cannot demote themselves without another owner (if multi-owner enabled)
- Actions are logged for audit trail

**Assignment:**
- Automatically assigned to group creator
- Can be transferred to another member
- Only one owner per group (unless multi-owner feature enabled)

---

### 1.3 Moderator Role

**Description:** Trusted members with elevated permissions to manage content and members.

**Hierarchy Level:** 2 (Middle)

**Inherits From:** Member (Level 1)

**Default Permissions:**
- ALL Member permissions
- Approve/reject membership requests
- Remove members (except owner and other moderators)
- Mute members temporarily
- Delete any member's posts/comments
- Pin/unpin posts
- Edit group description and rules
- Manage post approval queue
- Review and action reports
- Access moderation logs
- Ban/unban members (except owner and other moderators)

**Limitations:**
- Cannot remove or ban the owner
- Cannot remove or ban other moderators
- Cannot change group privacy settings
- Cannot delete the group
- Cannot assign/revoke moderator roles
- Actions are logged for audit trail

**Assignment:**
- Assigned by the owner only
- Can be revoked by the owner
- Multiple moderators allowed per group

---

### 1.4 Member Role

**Description:** Standard group participants with basic content creation and interaction permissions.

**Hierarchy Level:** 1 (Base)

**Inherits From:** None (base role)

**Default Permissions:**
- View group content
- Create posts (subject to moderation rules)
- Comment on posts
- React to posts/comments (like, etc.)
- Edit own posts (within time limit if configured)
- Delete own posts (within time limit if configured)
- Share posts
- Invite members (if group settings allow)
- Leave the group
- View member list
- Report inappropriate content
- Update own notification preferences

**Limitations:**
- Cannot modify other members' content
- Cannot remove other members
- Cannot approve membership requests
- Cannot access moderation features
- Cannot change group settings
- Post creation may require approval (based on group settings)

**Assignment:**
- Automatically assigned when joining a group
- Granted upon approval for private groups
- Default role for all group participants

---

## 2. Permission Matrix

### 2.1 Complete Permission Table

| Category | Action | Owner | Moderator | Member | Requires Approval | Audit Log |
|----------|--------|:-----:|:---------:|:------:|:----------------:|:---------:|
| **Group Management** |
| Create Group | ✓ | ✗ | ✗ | ✗ | ✓ |
| Edit Group Name | ✓ | ✗ | ✗ | ✗ | ✓ |
| Edit Group Description | ✓ | ✓ | ✗ | ✗ | ✓ |
| Edit Group Rules | ✓ | ✓ | ✗ | ✗ | ✓ |
| Delete Group | ✓ | ✗ | ✗ | ✗ | ✓ |
| Archive Group | ✓ | ✗ | ✗ | ✗ | ✓ |
| Unarchive Group | ✓ | ✗ | ✗ | ✗ | ✓ |
| Transfer Ownership | ✓ | ✗ | ✗ | ✗ | ✓ |
| Export Group Data | ✓ | ✗ | ✗ | ✗ | ✓ |
| **Privacy Settings** |
| Change Privacy (Public/Private) | ✓ | ✗ | ✗ | ✗ | ✓ |
| Enable/Disable Post Approval | ✓ | ✗ | ✗ | ✗ | ✓ |
| Set Member Approval Required | ✓ | ✗ | ✗ | ✗ | ✓ |
| Configure Join Questions | ✓ | ✗ | ✗ | ✗ | ✓ |
| **Member Management** |
| View Member List | ✓ | ✓ | ✓ | ✗ | ✗ |
| Invite Members | ✓ | ✓ | ✓* | ✗ | ✓ |
| Approve Member Requests | ✓ | ✓ | ✗ | ✗ | ✓ |
| Reject Member Requests | ✓ | ✓ | ✗ | ✗ | ✓ |
| Remove Members | ✓ | ✓** | ✗ | ✗ | ✓ |
| Ban Members | ✓ | ✓** | ✗ | ✗ | ✓ |
| Unban Members | ✓ | ✓ | ✗ | ✗ | ✓ |
| Mute Members | ✓ | ✓** | ✗ | Varies | ✓ |
| Unmute Members | ✓ | ✓ | ✗ | ✗ | ✓ |
| Assign Moderator Role | ✓ | ✗ | ✗ | ✗ | ✓ |
| Revoke Moderator Role | ✓ | ✗ | ✗ | ✗ | ✓ |
| Leave Group | ✓*** | ✓ | ✓ | ✗ | ✓ |
| **Content Management** |
| Create Post | ✓ | ✓ | ✓ | Varies | ✓ |
| Edit Own Post | ✓ | ✓ | ✓ | Varies | ✓ |
| Delete Own Post | ✓ | ✓ | ✓ | Varies | ✓ |
| Edit Others' Posts | ✓ | ✓ | ✗ | ✗ | ✓ |
| Delete Others' Posts | ✓ | ✓ | ✗ | ✗ | ✓ |
| Pin Post | ✓ | ✓ | ✗ | ✗ | ✓ |
| Unpin Post | ✓ | ✓ | ✗ | ✗ | ✓ |
| Comment on Post | ✓ | ✓ | ✓ | ✗ | ✓ |
| Edit Own Comment | ✓ | ✓ | ✓ | Varies | ✓ |
| Delete Own Comment | ✓ | ✓ | ✓ | Varies | ✓ |
| Delete Others' Comments | ✓ | ✓ | ✗ | ✗ | ✓ |
| React to Content | ✓ | ✓ | ✓ | ✗ | ✗ |
| Share Post | ✓ | ✓ | ✓ | ✗ | ✗ |
| **Moderation** |
| Approve Pending Posts | ✓ | ✓ | ✗ | ✗ | ✓ |
| Reject Pending Posts | ✓ | ✓ | ✗ | ✗ | ✓ |
| View Reports | ✓ | ✓ | ✗ | ✗ | ✓ |
| Action Reports | ✓ | ✓ | ✗ | ✗ | ✓ |
| Report Content | ✓ | ✓ | ✓ | ✗ | ✓ |
| View Moderation Logs | ✓ | ✓ | ✗ | ✗ | ✗ |
| View Audit Trail | ✓ | ✗ | ✗ | ✗ | ✗ |
| **Notifications** |
| Configure Own Notifications | ✓ | ✓ | ✓ | ✗ | ✗ |
| Configure Group Notifications | ✓ | ✗ | ✗ | ✗ | ✓ |

**Legend:**
- ✓ = Allowed
- ✗ = Denied
- * = Conditional (depends on group settings)
- ** = Cannot perform on Owner or other Moderators
- *** = Owner must transfer ownership first

---

## 3. Permission Rules

### 3.1 Group Management Rules

#### Create Group
**Who:** Any authenticated user
**Conditions:**
- User must have verified account
- User must not exceed group creation limit (if configured)
- Group name must be unique within the system

**Edge Cases:**
- Newly created group automatically assigns creator as Owner
- Group starts in "active" status unless auto-moderation enabled

**Audit:** Log user ID, group ID, timestamp, group settings

---

#### Edit Group Name/Description/Rules
**Who:** Owner for name, Owner & Moderator for description/rules
**Conditions:**
- Group must not be archived
- New name must be unique (if changing name)
- Description must meet length requirements (1-5000 characters)

**Edge Cases:**
- Name changes may affect group discoverability
- Changes are versioned for rollback capability
- URL slug may change with name change

**Audit:** Log old value, new value, changed by user ID, timestamp

---

#### Delete Group
**Who:** Owner only
**Conditions:**
- Confirmation required (two-step process)
- Grace period before permanent deletion (30 days)
- All members are notified

**Edge Cases:**
- Soft delete first, then hard delete after grace period
- Cannot be undone after grace period
- All content is archived for compliance

**Audit:** Log owner ID, deletion timestamp, member count, content count

---

#### Archive/Unarchive Group
**Who:** Owner only
**Conditions:**
- Archived groups are read-only
- No new members can join archived groups
- Existing members can still view content

**Edge Cases:**
- Moderators retain roles but cannot moderate
- Posts cannot be created in archived groups
- Can be unarchived at any time

**Audit:** Log status change, owner ID, timestamp

---

#### Transfer Ownership
**Who:** Owner only
**Conditions:**
- New owner must be an existing member
- New owner must accept the transfer
- Original owner becomes a moderator (or member, if declined)

**Edge Cases:**
- Transfer can be cancelled before acceptance
- If new owner declines, original owner retains ownership
- Transfer expires after 7 days if not accepted

**Audit:** Log previous owner, new owner, acceptance timestamp

---

### 3.2 Member Management Rules

#### Invite Members
**Who:** Owner, Moderator, Members (if enabled)
**Conditions:**
- Group must not be at member limit
- Invitee must not be banned from group
- Invitee must not have declined a recent invitation

**Edge Cases:**
- Private groups require invitation for access
- Invitation expires after 30 days
- User can receive multiple invitations from different members

**Audit:** Log inviter ID, invitee ID, invitation status, timestamp

---

#### Approve/Reject Member Requests
**Who:** Owner, Moderator
**Conditions:**
- Only applicable for private/approval-required groups
- Request must be pending
- Can include optional rejection message

**Edge Cases:**
- Rejected users can reapply after 7 days
- Approved users are immediately added as Members
- Requests expire after 30 days

**Audit:** Log approver ID, applicant ID, decision, reason, timestamp

---

#### Remove Members
**Who:** Owner (any member), Moderator (Members only, not Owner/Moderator)
**Conditions:**
- Cannot remove yourself (must use Leave Group)
- Moderators cannot remove Owner or other Moderators
- Removal reason is optional but recommended

**Edge Cases:**
- Removed member can rejoin if group is public (unless banned)
- Removed member's content remains in group
- Removed member loses access immediately

**Audit:** Log remover ID, removed member ID, reason, timestamp

---

#### Ban/Unban Members
**Who:** Owner (any member), Moderator (Members only, not Owner/Moderator)
**Conditions:**
- Ban reason is required
- Banned user cannot rejoin group
- Ban can be permanent or temporary

**Edge Cases:**
- Banned user's existing content remains visible (unless deleted)
- Banned user cannot view group content
- Temporary bans auto-expire after duration

**Audit:** Log banner ID, banned member ID, reason, duration, timestamp

---

#### Mute Members
**Who:** Owner (any member), Moderator (Members only, not Owner/Moderator)
**Conditions:**
- Mute prevents posting/commenting for duration
- User can still view content
- Duration is configurable (1 hour to 30 days)

**Edge Cases:**
- Muted user can still edit existing posts (if within time window)
- Muted user sees notification explaining mute
- Mute auto-expires after duration

**Audit:** Log muter ID, muted member ID, reason, duration, timestamp

---

#### Assign/Revoke Moderator Role
**Who:** Owner only
**Conditions:**
- Target member must be an existing member
- No limit on number of moderators (recommended max: 10)
- Moderator must accept the role

**Edge Cases:**
- If member declines, they remain a regular member
- Revoking moderator role returns them to member status
- Moderators can resign at any time

**Audit:** Log owner ID, moderator ID, action, timestamp

---

#### Leave Group
**Who:** Any member except Owner (Owner must transfer ownership first)
**Conditions:**
- Confirmation required
- User's content remains in group

**Edge Cases:**
- Owner cannot leave without transferring ownership
- Moderators automatically become members if they rejoin
- User can rejoin public groups immediately

**Audit:** Log user ID, timestamp, role at time of leaving

---

### 3.3 Content Management Rules

#### Create Post
**Who:** Owner, Moderator, Member
**Conditions:**
- Group must not be archived
- User must not be muted
- Content must meet community guidelines

**Edge Cases:**
- Posts may require approval based on group settings
- Pending posts are not visible until approved
- User can edit/delete pending posts

**Audit:** Log author ID, post ID, timestamp, approval status

---

#### Edit Own Post
**Who:** Post author
**Conditions:**
- Edit window may be limited (e.g., 30 minutes)
- Group must not be archived
- User must not be muted

**Edge Cases:**
- Edit history is maintained
- Edited posts show "edited" indicator
- After edit window, content is locked

**Audit:** Log editor ID, post ID, old content hash, new content hash, timestamp

---

#### Delete Own Post
**Who:** Post author, Owner, Moderator
**Conditions:**
- Deletion window may be limited for author
- Owner and Moderator can delete anytime

**Edge Cases:**
- Soft delete first (recoverable for 30 days)
- Comments on deleted posts are also deleted
- Reactions are removed

**Audit:** Log deleter ID, post ID, reason, timestamp

---

#### Edit/Delete Others' Posts
**Who:** Owner, Moderator
**Conditions:**
- Reason is required
- Original author is notified
- Content is preserved in moderation logs

**Edge Cases:**
- Cannot edit posts to change meaning dramatically
- Typically used for policy violations
- Author can appeal moderation actions

**Audit:** Log moderator ID, post ID, action, reason, timestamp

---

#### Pin/Unpin Post
**Who:** Owner, Moderator
**Conditions:**
- Maximum 3 pinned posts per group
- Pinned posts appear at top of feed
- Any member's post can be pinned

**Edge Cases:**
- Pinning 4th post automatically unpins oldest
- Pinned posts are marked with indicator
- Pin status persists across feed refreshes

**Audit:** Log pinner ID, post ID, action, timestamp

---

#### Comment on Post
**Who:** Owner, Moderator, Member
**Conditions:**
- Post must allow comments (if author disabled them)
- User must not be muted
- Group must not be archived

**Edge Cases:**
- Comments may be nested (threads)
- Comment approval may be required
- Comments can be reported

**Audit:** Log commenter ID, post ID, comment ID, timestamp

---

### 3.4 Moderation Rules

#### Approve/Reject Pending Posts
**Who:** Owner, Moderator
**Conditions:**
- Post must be in pending status
- Reason for rejection should be provided
- Author is notified of decision

**Edge Cases:**
- Rejected posts can be edited and resubmitted
- Auto-approval can be configured for trusted members
- Approval queue is shared among all moderators

**Audit:** Log moderator ID, post ID, decision, reason, timestamp

---

#### Report Content
**Who:** Any member
**Conditions:**
- Must select report reason
- Optional description (recommended)
- Cannot spam reports

**Edge Cases:**
- User can report any content (posts/comments)
- Anonymous reporting to other members
- Report submitter is tracked internally
- Duplicate reports are merged

**Audit:** Log reporter ID, content ID, reason, timestamp

---

#### Action Reports
**Who:** Owner, Moderator
**Conditions:**
- Must review reported content
- Must take action: dismiss, delete, or escalate
- Reporter is notified of outcome

**Edge Cases:**
- Multiple reports on same content are batched
- Auto-action if threshold reached (e.g., 5 reports)
- Can ban user based on repeated violations

**Audit:** Log moderator ID, report ID, action, reason, timestamp

---

#### View Moderation Logs
**Who:** Owner, Moderator
**Conditions:**
- Shows all moderation actions
- Filterable by action type, moderator, date
- Read-only

**Edge Cases:**
- Logs retained for compliance period (e.g., 2 years)
- Owner can see all actions, moderators see own + others
- Logs cannot be deleted

**Audit:** Log viewer ID, query parameters, timestamp

---

#### View Audit Trail
**Who:** Owner only
**Conditions:**
- Shows all significant group changes
- Includes setting changes, role assignments, deletions
- Read-only

**Edge Cases:**
- More comprehensive than moderation logs
- Includes system-generated events
- Exportable for compliance

**Audit:** Log viewer ID, export actions, timestamp

---

### 3.5 Privacy & Settings Rules

#### Change Group Privacy
**Who:** Owner only
**Conditions:**
- Changing public → private notifies all members
- Changing private → public requires confirmation
- Affects discoverability and join process

**Edge Cases:**
- Existing members are not removed when changing privacy
- Private groups require approval for new members
- Public groups allow anyone to join

**Audit:** Log old privacy, new privacy, owner ID, timestamp

---

#### Configure Post Approval
**Who:** Owner only
**Conditions:**
- Can require approval for all posts or specific members
- Affects new posts immediately

**Edge Cases:**
- Existing posts are not affected
- Trusted members can be exempted
- Auto-approval for moderators

**Audit:** Log setting change, owner ID, timestamp

---

#### Configure Notifications
**Who:** Owner (group-wide), All members (personal)
**Conditions:**
- Group-wide settings are defaults for new members
- Members can override with personal preferences

**Edge Cases:**
- Cannot force members to receive notifications
- Email vs push vs in-app notifications
- Frequency controls (immediate, digest, off)

**Audit:** Log user ID, setting changes, timestamp

---

## 4. Test Scenarios

### 4.1 Group Management Test Scenarios

```gherkin
Feature: Group Creation
  As an authenticated user
  I want to create a new group
  So that I can build a community around shared interests

  Scenario: Successful group creation by authenticated user
    Given I am logged in as "john@example.com"
    And I have not exceeded the group creation limit
    When I create a group with name "Hiking Enthusiasts"
    And I set the description as "A group for local hiking lovers"
    And I set privacy to "public"
    Then the group should be created successfully
    And I should be assigned the "Owner" role
    And I should see a success message "Group created successfully"
    And the group should be in "active" status

  Scenario: Group creation fails with duplicate name
    Given I am logged in as "john@example.com"
    And a group named "Hiking Enthusiasts" already exists
    When I attempt to create a group with name "Hiking Enthusiasts"
    Then the creation should fail
    And I should see an error "Group name already exists"

  Scenario: Group creation fails for unverified user
    Given I am logged in as "unverified@example.com"
    And my account is not verified
    When I attempt to create a group
    Then the creation should fail with status 403
    And I should see an error "Please verify your email first"

  Scenario: Group creation fails when limit exceeded
    Given I am logged in as "john@example.com"
    And I have already created 10 groups
    And the group creation limit is 10
    When I attempt to create another group
    Then the creation should fail with status 429
    And I should see an error "Group creation limit reached"
```

```gherkin
Feature: Group Deletion
  As a group owner
  I want to delete my group
  So that I can remove communities that are no longer needed

  Scenario: Successful group deletion by owner
    Given I am logged in as owner of group "Old Group"
    And the group has 5 members
    When I request to delete the group
    And I confirm the deletion
    Then the group should be soft-deleted
    And all members should be notified
    And the group should enter 30-day grace period
    And I should see "Group will be permanently deleted in 30 days"

  Scenario: Group deletion fails for non-owner
    Given I am logged in as "jane@example.com"
    And I am a moderator of group "Old Group"
    When I attempt to delete the group
    Then the request should fail with status 403
    And I should see an error "Only the owner can delete this group"

  Scenario: Owner cannot delete without confirmation
    Given I am logged in as owner of group "Old Group"
    When I request to delete the group
    But I do not confirm the deletion
    Then the group should not be deleted
    And I should see a confirmation dialog

  Scenario: Permanent deletion after grace period
    Given I deleted group "Old Group" 30 days ago
    When the grace period expires
    Then the group should be permanently deleted
    And all content should be archived
    And the group name should become available
```

```gherkin
Feature: Group Archiving
  As a group owner
  I want to archive my group
  So that I can preserve content while preventing new activity

  Scenario: Successful group archiving
    Given I am logged in as owner of group "Summer 2024"
    And the group has 20 members
    When I archive the group
    Then the group status should change to "archived"
    And members should be able to view content
    But members should not be able to post
    And new members should not be able to join
    And I should see "Group archived successfully"

  Scenario: Moderator cannot archive group
    Given I am logged in as "jane@example.com"
    And I am a moderator of group "Summer 2024"
    When I attempt to archive the group
    Then the request should fail with status 403
    And I should see an error "Only the owner can archive this group"

  Scenario: Unarchiving a group
    Given I am logged in as owner of group "Summer 2024"
    And the group is currently archived
    When I unarchive the group
    Then the group status should change to "active"
    And members should be able to post again
    And new members should be able to join
```

```gherkin
Feature: Transfer Ownership
  As a group owner
  I want to transfer ownership to another member
  So that I can step down while preserving the community

  Scenario: Successful ownership transfer
    Given I am logged in as owner of group "Leadership Team"
    And "jane@example.com" is a member of the group
    When I transfer ownership to "jane@example.com"
    Then a transfer request should be sent to Jane
    And Jane should see a notification "John wants to transfer ownership"
    And the transfer should be pending acceptance

  Scenario: New owner accepts transfer
    Given I am "jane@example.com"
    And I have a pending ownership transfer for group "Leadership Team"
    When I accept the ownership transfer
    Then I should become the new owner
    And "john@example.com" should become a moderator
    And all members should be notified of the change

  Scenario: New owner declines transfer
    Given I am "jane@example.com"
    And I have a pending ownership transfer for group "Leadership Team"
    When I decline the ownership transfer
    Then "john@example.com" should remain the owner
    And the transfer request should be cancelled
    And John should be notified of the decline

  Scenario: Transfer request expires
    Given I transferred ownership to "jane@example.com" 7 days ago
    And Jane has not responded
    When the 7-day window expires
    Then the transfer should be automatically cancelled
    And I should remain the owner
    And I should see "Transfer request expired"

  Scenario: Owner cannot transfer to non-member
    Given I am logged in as owner of group "Leadership Team"
    When I attempt to transfer ownership to "stranger@example.com"
    And "stranger@example.com" is not a member
    Then the request should fail with status 400
    And I should see "User must be a member to receive ownership"
```

---

### 4.2 Member Management Test Scenarios

```gherkin
Feature: Member Invitations
  As a group member with invitation privileges
  I want to invite others to join the group
  So that I can grow the community

  Scenario: Owner invites a new member
    Given I am logged in as owner of group "Book Club"
    When I invite "alice@example.com" to the group
    Then an invitation should be sent to Alice
    And Alice should receive an email notification
    And the invitation should expire in 30 days

  Scenario: Moderator invites a new member
    Given I am logged in as moderator of group "Book Club"
    When I invite "bob@example.com" to the group
    Then an invitation should be sent to Bob
    And the invitation should be tracked

  Scenario: Regular member invites when feature is enabled
    Given I am logged in as member of group "Book Club"
    And member invitations are enabled
    When I invite "charlie@example.com" to the group
    Then an invitation should be sent to Charlie

  Scenario: Regular member cannot invite when feature is disabled
    Given I am logged in as member of group "Book Club"
    And member invitations are disabled
    When I attempt to invite "charlie@example.com"
    Then the request should fail with status 403
    And I should see "Only moderators can invite members"

  Scenario: Cannot invite banned user
    Given I am logged in as owner of group "Book Club"
    And "banned@example.com" is banned from the group
    When I attempt to invite "banned@example.com"
    Then the request should fail with status 400
    And I should see "This user is banned from the group"

  Scenario: Invitation acceptance
    Given "alice@example.com" has been invited to group "Book Club"
    When Alice accepts the invitation
    Then Alice should be added as a member
    And Alice should have the "Member" role
    And the invitation should be marked as accepted
```

```gherkin
Feature: Member Approval
  As a group moderator
  I want to approve or reject membership requests
  So that I can control who joins the group

  Scenario: Moderator approves membership request
    Given I am logged in as moderator of private group "VIP Club"
    And "david@example.com" has requested to join
    When I approve the request
    Then David should be added as a member
    And David should receive a notification "Your request was approved"
    And I should see "Member approved successfully"

  Scenario: Moderator rejects membership request with reason
    Given I am logged in as moderator of private group "VIP Club"
    And "eve@example.com" has requested to join
    When I reject the request with reason "Does not meet criteria"
    Then Eve should not be added to the group
    And Eve should receive a notification with the reason
    And the request should be marked as rejected

  Scenario: Owner approves membership request
    Given I am logged in as owner of private group "VIP Club"
    And "frank@example.com" has requested to join
    When I approve the request
    Then Frank should be added as a member

  Scenario: Regular member cannot approve requests
    Given I am logged in as member of private group "VIP Club"
    And "george@example.com" has requested to join
    When I attempt to approve the request
    Then the request should fail with status 403
    And I should see "Only moderators can approve members"

  Scenario: Request expires after 30 days
    Given "helen@example.com" requested to join 30 days ago
    And the request has not been actioned
    When the 30-day window expires
    Then the request should be automatically rejected
    And Helen should be notified "Your request has expired"
```

```gherkin
Feature: Member Removal
  As a group moderator
  I want to remove members who violate rules
  So that I can maintain group quality

  Scenario: Owner removes a regular member
    Given I am logged in as owner of group "Fitness Group"
    And "spammer@example.com" is a member
    When I remove "spammer@example.com" with reason "Spam posts"
    Then the member should be removed immediately
    And the member should lose group access
    And the member's content should remain
    And the action should be logged

  Scenario: Moderator removes a regular member
    Given I am logged in as moderator of group "Fitness Group"
    And "troublemaker@example.com" is a member
    When I remove "troublemaker@example.com" with reason "Harassment"
    Then the member should be removed immediately
    And the action should be logged

  Scenario: Moderator cannot remove owner
    Given I am logged in as moderator of group "Fitness Group"
    And "owner@example.com" is the group owner
    When I attempt to remove "owner@example.com"
    Then the request should fail with status 403
    And I should see "Cannot remove the group owner"

  Scenario: Moderator cannot remove another moderator
    Given I am logged in as moderator of group "Fitness Group"
    And "jane@example.com" is also a moderator
    When I attempt to remove "jane@example.com"
    Then the request should fail with status 403
    And I should see "Cannot remove other moderators"

  Scenario: Member cannot remove other members
    Given I am logged in as member of group "Fitness Group"
    When I attempt to remove another member
    Then the request should fail with status 403
    And I should see "Insufficient permissions"

  Scenario: Removed member can rejoin public group
    Given "removed@example.com" was removed from public group "Fitness Group"
    And the user is not banned
    When "removed@example.com" requests to rejoin
    Then the request should be allowed
    And the user should be added as a new member
```

```gherkin
Feature: Member Banning
  As a group moderator
  I want to ban problematic members
  So that I can prevent them from rejoining

  Scenario: Owner bans a member permanently
    Given I am logged in as owner of group "Safe Space"
    And "toxic@example.com" is a member
    When I ban "toxic@example.com" permanently with reason "Hate speech"
    Then the member should be removed immediately
    And the member should be prevented from rejoining
    And the ban should have no expiration date
    And the action should be logged

  Scenario: Moderator bans a member temporarily
    Given I am logged in as moderator of group "Safe Space"
    And "rule-breaker@example.com" is a member
    When I ban "rule-breaker@example.com" for 7 days with reason "Multiple violations"
    Then the member should be removed immediately
    And the ban should expire in 7 days
    And the action should be logged

  Scenario: Temporary ban expires automatically
    Given "rule-breaker@example.com" was banned for 7 days
    When 7 days have passed
    Then the ban should be automatically lifted
    And the user should be able to rejoin
    And the user should receive notification "Your ban has expired"

  Scenario: Owner unbans a member
    Given I am logged in as owner of group "Safe Space"
    And "reformed@example.com" is currently banned
    When I unban "reformed@example.com"
    Then the ban should be removed
    And the user should be able to rejoin
    And the action should be logged

  Scenario: Moderator cannot ban owner
    Given I am logged in as moderator of group "Safe Space"
    And "owner@example.com" is the group owner
    When I attempt to ban "owner@example.com"
    Then the request should fail with status 403
    And I should see "Cannot ban the group owner"

  Scenario: Moderator cannot ban another moderator
    Given I am logged in as moderator of group "Safe Space"
    And "jane@example.com" is also a moderator
    When I attempt to ban "jane@example.com"
    Then the request should fail with status 403
    And I should see "Cannot ban other moderators"

  Scenario: Banned user cannot view group content
    Given "toxic@example.com" is banned from group "Safe Space"
    When the user attempts to view group content
    Then the request should fail with status 403
    And I should see "You are banned from this group"
```

```gherkin
Feature: Member Muting
  As a group moderator
  I want to temporarily mute disruptive members
  So that I can control spam without full removal

  Scenario: Moderator mutes a member for 1 hour
    Given I am logged in as moderator of group "Discussion Forum"
    And "chatty@example.com" is a member
    When I mute "chatty@example.com" for 1 hour with reason "Spam"
    Then the member should be unable to post or comment
    But the member should still be able to view content
    And the mute should expire in 1 hour
    And the member should see notification "You are muted for 1 hour"

  Scenario: Owner mutes a member for 24 hours
    Given I am logged in as owner of group "Discussion Forum"
    And "disruptive@example.com" is a member
    When I mute "disruptive@example.com" for 24 hours with reason "Off-topic posts"
    Then the member should be unable to post or comment
    And the mute should expire in 24 hours

  Scenario: Muted member attempts to post
    Given "chatty@example.com" is muted for 1 hour
    When the user attempts to create a post
    Then the request should fail with status 403
    And I should see "You are currently muted. Reason: Spam"
    And I should see "Mute expires in: 45 minutes"

  Scenario: Muted member can still edit existing posts
    Given "chatty@example.com" is muted for 1 hour
    And the user has an existing post
    When the user edits their existing post within the edit window
    Then the edit should be allowed
    And the post should be updated

  Scenario: Mute expires automatically
    Given "chatty@example.com" was muted for 1 hour
    When 1 hour has passed
    Then the mute should be automatically lifted
    And the user should be able to post again
    And the user should receive notification "Your mute has expired"

  Scenario: Moderator unmutes a member early
    Given I am logged in as moderator of group "Discussion Forum"
    And "reformed@example.com" is currently muted
    When I unmute "reformed@example.com"
    Then the mute should be removed immediately
    And the user should be able to post again
    And the action should be logged

  Scenario: Moderator cannot mute owner
    Given I am logged in as moderator of group "Discussion Forum"
    And "owner@example.com" is the group owner
    When I attempt to mute "owner@example.com"
    Then the request should fail with status 403
    And I should see "Cannot mute the group owner"
```

```gherkin
Feature: Moderator Role Assignment
  As a group owner
  I want to assign and revoke moderator roles
  So that I can delegate moderation responsibilities

  Scenario: Owner assigns moderator role
    Given I am logged in as owner of group "Large Community"
    And "trusted@example.com" is a member
    When I assign moderator role to "trusted@example.com"
    Then a role assignment request should be sent
    And "trusted@example.com" should receive notification
    And the request should be pending acceptance

  Scenario: Member accepts moderator role
    Given "trusted@example.com" has been offered moderator role
    When the user accepts the role
    Then the user should become a moderator
    And the user should gain moderator permissions
    And the owner should be notified
    And the action should be logged

  Scenario: Member declines moderator role
    Given "busy@example.com" has been offered moderator role
    When the user declines the role
    Then the user should remain a regular member
    And the owner should be notified
    And the offer should be cancelled

  Scenario: Owner revokes moderator role
    Given I am logged in as owner of group "Large Community"
    And "former-mod@example.com" is a moderator
    When I revoke moderator role from "former-mod@example.com"
    Then the user should become a regular member
    And the user should lose moderator permissions immediately
    And the user should be notified
    And the action should be logged

  Scenario: Moderator voluntarily resigns
    Given I am logged in as moderator of group "Large Community"
    When I resign from moderator role
    Then I should become a regular member
    And I should lose moderator permissions immediately
    And the owner should be notified
    And the action should be logged

  Scenario: Non-owner cannot assign moderator role
    Given I am logged in as moderator of group "Large Community"
    When I attempt to assign moderator role to another member
    Then the request should fail with status 403
    And I should see "Only the owner can assign moderators"

  Scenario: Cannot assign moderator to non-member
    Given I am logged in as owner of group "Large Community"
    When I attempt to assign moderator role to "nonmember@example.com"
    And the user is not a member
    Then the request should fail with status 400
    And I should see "User must be a member first"
```

```gherkin
Feature: Leave Group
  As a group member
  I want to leave a group
  So that I can stop receiving updates from unwanted communities

  Scenario: Regular member leaves group
    Given I am logged in as member of group "Book Club"
    When I request to leave the group
    And I confirm the action
    Then I should be removed from the group
    And I should lose access to group content
    And my posts should remain in the group
    And other members should not be notified

  Scenario: Moderator leaves group
    Given I am logged in as moderator of group "Book Club"
    When I request to leave the group
    And I confirm the action
    Then I should be removed from the group
    And my moderator role should be revoked
    And the owner should be notified

  Scenario: Owner cannot leave without transferring ownership
    Given I am logged in as owner of group "Book Club"
    When I attempt to leave the group
    Then the request should fail with status 400
    And I should see "Transfer ownership before leaving"
    And I should see option to transfer ownership

  Scenario: Member rejoins after leaving
    Given "member@example.com" left public group "Book Club"
    When the user requests to rejoin
    Then the user should be added as a new member
    And previous membership history should be preserved
    And the user should start with Member role
```

---

### 4.3 Content Management Test Scenarios

```gherkin
Feature: Post Creation
  As a group member
  I want to create posts
  So that I can share content with the community

  Scenario: Member creates post in group without approval requirement
    Given I am logged in as member of group "Open Forum"
    And post approval is not required
    When I create a post with content "Check out this article"
    Then the post should be published immediately
    And all members should be able to see it
    And I should see "Post published successfully"

  Scenario: Member creates post requiring approval
    Given I am logged in as member of group "Moderated Forum"
    And post approval is required for regular members
    When I create a post with content "My first post"
    Then the post should be marked as "pending"
    And only I and moderators should be able to see it
    And I should see "Post submitted for approval"
    And moderators should be notified

  Scenario: Moderator post bypasses approval
    Given I am logged in as moderator of group "Moderated Forum"
    And post approval is required for regular members
    When I create a post
    Then the post should be published immediately
    And approval should be bypassed

  Scenario: Muted member cannot create post
    Given I am logged in as member of group "Discussion Group"
    And I am currently muted for 2 hours
    When I attempt to create a post
    Then the request should fail with status 403
    And I should see "You are muted. Reason: Spam"
    And I should see remaining mute duration

  Scenario: Cannot create post in archived group
    Given I am logged in as member of archived group "Old Group"
    When I attempt to create a post
    Then the request should fail with status 403
    And I should see "This group is archived"
```

```gherkin
Feature: Post Editing
  As a post author
  I want to edit my posts
  So that I can correct mistakes or update information

  Scenario: Author edits own post within time limit
    Given I am logged in as "author@example.com"
    And I created a post 5 minutes ago
    And the edit window is 30 minutes
    When I edit the post content
    Then the post should be updated
    And the post should show "edited" indicator
    And the edit should be logged in edit history

  Scenario: Author cannot edit post after time limit
    Given I am logged in as "author@example.com"
    And I created a post 31 minutes ago
    And the edit window is 30 minutes
    When I attempt to edit the post
    Then the request should fail with status 403
    And I should see "Edit window has expired"

  Scenario: Moderator edits any member's post
    Given I am logged in as moderator of group "Discussion Forum"
    And "member@example.com" created a post
    When I edit the post with reason "Remove profanity"
    Then the post should be updated
    And the original author should be notified
    And the edit should be logged with reason
    And the post should show "edited by moderator"

  Scenario: Owner edits any member's post
    Given I am logged in as owner of group "Discussion Forum"
    And "member@example.com" created a post
    When I edit the post with reason "Policy violation"
    Then the post should be updated
    And the action should be logged

  Scenario: Regular member cannot edit other's posts
    Given I am logged in as "member1@example.com"
    And "member2@example.com" created a post
    When I attempt to edit the post
    Then the request should fail with status 403
    And I should see "You can only edit your own posts"

  Scenario: Edit history is maintained
    Given I created a post 10 minutes ago
    When I edit the post 3 times
    Then the edit history should show all 3 edits
    And each edit should have timestamp
    And moderators should be able to view edit history
```

```gherkin
Feature: Post Deletion
  As a post author or moderator
  I want to delete posts
  So that I can remove inappropriate or unwanted content

  Scenario: Author deletes own post within time limit
    Given I am logged in as "author@example.com"
    And I created a post 10 minutes ago
    And the deletion window is 30 minutes
    When I delete the post
    Then the post should be soft-deleted
    And the post should be hidden from other members
    And the post should be recoverable for 30 days

  Scenario: Author cannot delete post after time limit
    Given I am logged in as "author@example.com"
    And I created a post 31 minutes ago
    And the deletion window is 30 minutes
    When I attempt to delete the post
    Then the request should fail with status 403
    And I should see "Deletion window has expired"

  Scenario: Moderator deletes any member's post
    Given I am logged in as moderator of group "Safe Space"
    And "violator@example.com" created an inappropriate post
    When I delete the post with reason "Harassment"
    Then the post should be soft-deleted immediately
    And the author should be notified with reason
    And the action should be logged
    And the post content should be preserved in moderation logs

  Scenario: Owner deletes any member's post
    Given I am logged in as owner of group "Safe Space"
    And "member@example.com" created a post
    When I delete the post with reason "Off-topic"
    Then the post should be soft-deleted
    And the action should be logged

  Scenario: Soft-deleted post is permanently deleted after grace period
    Given a post was soft-deleted 30 days ago
    When the grace period expires
    Then the post should be permanently deleted
    And all comments should be permanently deleted
    And all reactions should be removed

  Scenario: Member cannot delete other's posts
    Given I am logged in as "member1@example.com"
    And "member2@example.com" created a post
    When I attempt to delete the post
    Then the request should fail with status 403
    And I should see "You can only delete your own posts"

  Scenario: Deleting post also deletes comments
    Given I am logged in as moderator of group "Discussion Forum"
    And a post has 10 comments
    When I delete the post
    Then all 10 comments should also be soft-deleted
    And comment authors should not be individually notified
```

```gherkin
Feature: Post Pinning
  As a group moderator
  I want to pin important posts
  So that members see them first

  Scenario: Moderator pins a post
    Given I am logged in as moderator of group "Announcements"
    And there are 0 currently pinned posts
    When I pin a post titled "Welcome New Members"
    Then the post should appear at the top of the feed
    And the post should show a "pinned" indicator
    And the action should be logged

  Scenario: Owner pins a post
    Given I am logged in as owner of group "Announcements"
    When I pin a post
    Then the post should be pinned successfully

  Scenario: Pinning 4th post unpins oldest
    Given I am logged in as moderator of group "Announcements"
    And there are already 3 pinned posts
    When I pin a 4th post
    Then the oldest pinned post should be automatically unpinned
    And the new post should be pinned
    And I should see "Oldest pinned post was unpinned"

  Scenario: Moderator unpins a post
    Given I am logged in as moderator of group "Announcements"
    And a post is currently pinned
    When I unpin the post
    Then the post should return to normal feed position
    And the "pinned" indicator should be removed
    And the action should be logged

  Scenario: Regular member cannot pin posts
    Given I am logged in as member of group "Announcements"
    When I attempt to pin a post
    Then the request should fail with status 403
    And I should see "Only moderators can pin posts"

  Scenario: Pinned posts persist across feed refreshes
    Given I am logged in as member of group "Announcements"
    And there are 2 pinned posts
    When I refresh the group feed
    Then the 2 pinned posts should still appear at the top
    And they should be in the correct order
```

```gherkin
Feature: Comments
  As a group member
  I want to comment on posts
  So that I can participate in discussions

  Scenario: Member comments on a post
    Given I am logged in as member of group "Tech Talk"
    And there is a post by "author@example.com"
    When I comment "Great article!"
    Then the comment should be published immediately
    And the post author should be notified
    And my comment should appear under the post

  Scenario: Muted member cannot comment
    Given I am logged in as member of group "Tech Talk"
    And I am currently muted
    When I attempt to comment on a post
    Then the request should fail with status 403
    And I should see "You are muted and cannot comment"

  Scenario: Author edits own comment within time limit
    Given I am logged in as "commenter@example.com"
    And I commented 5 minutes ago
    And the edit window is 15 minutes
    When I edit my comment
    Then the comment should be updated
    And the comment should show "edited" indicator

  Scenario: Moderator deletes any comment
    Given I am logged in as moderator of group "Tech Talk"
    And "member@example.com" posted an inappropriate comment
    When I delete the comment with reason "Spam"
    Then the comment should be removed
    And the commenter should be notified
    And the action should be logged

  Scenario: Author deletes own comment
    Given I am logged in as "commenter@example.com"
    And I posted a comment 5 minutes ago
    When I delete my comment
    Then the comment should be removed
    And I should see "Comment deleted"

  Scenario: Comments disabled by post author
    Given I am logged in as member of group "Tech Talk"
    And there is a post with comments disabled
    When I attempt to comment
    Then the request should fail with status 403
    And I should see "Comments are disabled for this post"
```

---

### 4.4 Moderation Test Scenarios

```gherkin
Feature: Post Approval Queue
  As a group moderator
  I want to review and approve pending posts
  So that I can ensure content quality

  Scenario: Moderator approves pending post
    Given I am logged in as moderator of group "Quality Forum"
    And "newmember@example.com" submitted a post for approval
    When I review the pending post
    And I approve it
    Then the post should be published to all members
    And the author should be notified "Your post was approved"
    And the action should be logged

  Scenario: Moderator rejects pending post with reason
    Given I am logged in as moderator of group "Quality Forum"
    And "member@example.com" submitted a post for approval
    When I review the pending post
    And I reject it with reason "Off-topic content"
    Then the post should remain unpublished
    And the author should be notified with reason
    And the author should be able to edit and resubmit
    And the action should be logged

  Scenario: Owner approves pending post
    Given I am logged in as owner of group "Quality Forum"
    And there is a pending post
    When I approve the post
    Then the post should be published

  Scenario: Author edits and resubmits rejected post
    Given I am "member@example.com"
    And my post was rejected with reason "Needs more detail"
    When I edit the post with additional details
    And I resubmit for approval
    Then the post should re-enter the approval queue
    And moderators should be notified

  Scenario: Approval queue shows all pending posts
    Given I am logged in as moderator of group "Quality Forum"
    And there are 5 pending posts
    When I view the approval queue
    Then I should see all 5 pending posts
    And each should show author and submission time
    And I should be able to filter by date

  Scenario: Regular member cannot access approval queue
    Given I am logged in as member of group "Quality Forum"
    When I attempt to access the approval queue
    Then the request should fail with status 403
    And I should see "Only moderators can access this feature"
```

```gherkin
Feature: Content Reports
  As a group member
  I want to report inappropriate content
  So that moderators can review and take action

  Scenario: Member reports inappropriate post
    Given I am logged in as member of group "Community Forum"
    And there is a post with offensive content
    When I report the post
    And I select reason "Harassment"
    And I add description "Contains personal attacks"
    Then a report should be created
    And moderators should be notified
    And I should see "Report submitted. Moderators will review."

  Scenario: Member reports spam comment
    Given I am logged in as member of group "Community Forum"
    And there is a spam comment
    When I report the comment
    And I select reason "Spam"
    Then a report should be created
    And the report should be added to moderation queue

  Scenario: Multiple reports on same content are merged
    Given "member1@example.com" reported a post for "Spam"
    And "member2@example.com" reported the same post for "Spam"
    When "member3@example.com" reports the same post
    Then all reports should be merged into one
    And report count should be 3
    And moderators should see consolidated report

  Scenario: Auto-action triggered by report threshold
    Given a post has been reported by 5 different members
    And the auto-action threshold is 5 reports
    When the 5th report is submitted
    Then the post should be automatically hidden
    And moderators should be notified for review
    And all reporters should be notified "Content has been hidden"

  Scenario: User cannot spam reports
    Given I am logged in as "member@example.com"
    And I have submitted 10 reports in the last hour
    When I attempt to submit another report
    Then the request should fail with status 429
    And I should see "You have submitted too many reports. Please wait."

  Scenario: Anonymous reporting to other members
    Given I am logged in as "reporter@example.com"
    When I report a post
    Then my identity should be hidden from other members
    But my identity should be visible to moderators
    And the reported user should not know who reported them
```

```gherkin
Feature: Report Moderation
  As a group moderator
  I want to review and action reports
  So that I can maintain community standards

  Scenario: Moderator reviews and dismisses report
    Given I am logged in as moderator of group "Community Forum"
    And there is a report for "Minor issue"
    When I review the report
    And I dismiss it with reason "No violation found"
    Then the report should be marked as resolved
    And the reporter should be notified
    And the action should be logged

  Scenario: Moderator deletes reported content
    Given I am logged in as moderator of group "Community Forum"
    And there is a report for "Harassment"
    When I review the report
    And I decide to delete the content
    And I add reason "Violates community guidelines"
    Then the content should be deleted
    And the author should be notified with reason
    And all reporters should be notified "Action taken"
    And the report should be marked as resolved

  Scenario: Moderator bans user based on reports
    Given I am logged in as moderator of group "Community Forum"
    And "repeat-offender@example.com" has 5 violations
    When I review their latest report
    And I ban the user for 7 days
    Then the user should be banned
    And the reported content should be deleted
    And all reporters should be notified
    And the action should be logged

  Scenario: Owner reviews report history
    Given I am logged in as owner of group "Community Forum"
    When I view the report history
    Then I should see all resolved and pending reports
    And I should see which moderator handled each report
    And I should be able to filter by status and date

  Scenario: Moderator escalates serious violation
    Given I am logged in as moderator of group "Community Forum"
    And there is a report for "Illegal content"
    When I review the report
    And I escalate it to the owner
    Then the owner should be immediately notified
    And the report should be marked as "escalated"
    And I should see "Report escalated to owner"
```

```gherkin
Feature: Moderation Logs
  As a group moderator or owner
  I want to view moderation logs
  So that I can track all moderation actions

  Scenario: Moderator views own moderation actions
    Given I am logged in as moderator of group "Managed Forum"
    When I access the moderation logs
    Then I should see all my moderation actions
    And I should see actions by other moderators
    And each entry should show: action type, target, reason, timestamp

  Scenario: Owner views all moderation actions
    Given I am logged in as owner of group "Managed Forum"
    When I access the moderation logs
    Then I should see all moderation actions by all moderators
    And I should see system-generated actions
    And I should be able to filter by moderator, action type, date

  Scenario: Moderator filters logs by action type
    Given I am logged in as moderator of group "Managed Forum"
    When I access the moderation logs
    And I filter by action type "Member removal"
    Then I should see only member removal actions
    And results should be sorted by date (newest first)

  Scenario: Moderator exports moderation logs
    Given I am logged in as moderator of group "Managed Forum"
    When I export moderation logs for the past 30 days
    Then I should receive a CSV file
    And the file should contain all actions from that period
    And the export should be logged

  Scenario: Regular member cannot access moderation logs
    Given I am logged in as member of group "Managed Forum"
    When I attempt to access moderation logs
    Then the request should fail with status 403
    And I should see "Only moderators can view this page"

  Scenario: Moderation log retention
    Given moderation logs are set to retain for 2 years
    When a log entry is 2 years and 1 day old
    Then the log entry should be archived
    And it should no longer appear in standard view
    But it should be retrievable for compliance
```

```gherkin
Feature: Audit Trail
  As a group owner
  I want to view a complete audit trail
  So that I can track all significant group changes

  Scenario: Owner views complete audit trail
    Given I am logged in as owner of group "Enterprise Group"
    When I access the audit trail
    Then I should see all significant group events
    Including: settings changes, role assignments, deletions, privacy changes
    And each entry should show: event type, actor, details, timestamp

  Scenario: Audit trail includes setting changes
    Given I am the owner of group "Enterprise Group"
    And I changed group privacy from "public" to "private" yesterday
    When I view the audit trail
    Then I should see an entry showing:
      | Field | Value |
      | Event | Privacy Change |
      | Actor | owner@example.com |
      | Old Value | public |
      | New Value | private |
      | Timestamp | Yesterday's date |

  Scenario: Audit trail includes role assignments
    Given I assigned moderator role to "jane@example.com" last week
    When I view the audit trail
    Then I should see the role assignment event
    And I should see when Jane accepted the role
    And both events should be timestamped

  Scenario: Audit trail includes system events
    Given a member's temporary ban expired 5 days ago
    When I view the audit trail
    Then I should see a system-generated event "Ban expired"
    And the event should show the member's ID
    And it should be marked as "System Action"

  Scenario: Owner exports audit trail for compliance
    Given I am logged in as owner of group "Enterprise Group"
    When I export the audit trail for the past year
    Then I should receive a comprehensive CSV file
    And the file should include all event types
    And sensitive data should be properly handled
    And the export action should itself be logged

  Scenario: Non-owner cannot access audit trail
    Given I am logged in as moderator of group "Enterprise Group"
    When I attempt to access the audit trail
    Then the request should fail with status 403
    And I should see "Only the owner can view the audit trail"

  Scenario: Audit trail is immutable
    Given I am logged in as owner of group "Enterprise Group"
    When I view the audit trail
    Then I should not see any edit or delete options
    And entries should be append-only
    And tampering should be prevented via cryptographic signatures
```

---

### 4.5 Privacy & Settings Test Scenarios

```gherkin
Feature: Group Privacy Settings
  As a group owner
  I want to change group privacy settings
  So that I can control who can access the group

  Scenario: Owner changes group from public to private
    Given I am logged in as owner of group "Open Community"
    And the group currently has "public" privacy
    And the group has 100 members
    When I change privacy to "private"
    And I confirm the change
    Then the group privacy should be updated to "private"
    And all existing members should retain access
    And new users should require approval to join
    And all members should be notified of the change

  Scenario: Owner changes group from private to public
    Given I am logged in as owner of group "VIP Club"
    And the group currently has "private" privacy
    When I change privacy to "public"
    And I confirm the change
    Then the group privacy should be updated to "public"
    And new users should be able to join without approval
    And pending membership requests should be automatically approved
    And all members should be notified

  Scenario: Non-owner cannot change privacy settings
    Given I am logged in as moderator of group "Open Community"
    When I attempt to change group privacy
    Then the request should fail with status 403
    And I should see "Only the owner can change privacy settings"

  Scenario: Privacy change requires confirmation
    Given I am logged in as owner of group "Open Community"
    When I attempt to change privacy without confirmation
    Then the change should not be applied
    And I should see a confirmation dialog
    And the dialog should explain the implications
```

```gherkin
Feature: Post Approval Settings
  As a group owner
  I want to configure post approval requirements
  So that I can control content quality

  Scenario: Owner enables post approval for all members
    Given I am logged in as owner of group "Quality Forum"
    And post approval is currently disabled
    When I enable post approval for "all members"
    Then all new posts should require approval
    And existing posts should remain published
    And members should see "Posts require approval" notice

  Scenario: Owner enables post approval for new members only
    Given I am logged in as owner of group "Quality Forum"
    When I enable post approval for "new members"
    And I set the threshold to "30 days"
    Then members who joined less than 30 days ago should require approval
    And members who joined more than 30 days ago should post freely
    And moderators should always bypass approval

  Scenario: Owner disables post approval
    Given I am logged in as owner of group "Quality Forum"
    And post approval is currently enabled
    When I disable post approval
    Then all new posts should be published immediately
    And pending posts should be automatically approved
    And members should see "Posts no longer require approval"

  Scenario: Owner exempts trusted members from approval
    Given I am logged in as owner of group "Quality Forum"
    And post approval is enabled for all members
    When I exempt "trusted@example.com" from approval
    Then that member's posts should be published immediately
    And the exemption should be logged
    And I should see "Member exempted from post approval"

  Scenario: Non-owner cannot change approval settings
    Given I am logged in as moderator of group "Quality Forum"
    When I attempt to change post approval settings
    Then the request should fail with status 403
    And I should see "Only the owner can change approval settings"
```

```gherkin
Feature: Member Join Settings
  As a group owner
  I want to configure how members can join
  So that I can control group access

  Scenario: Owner enables membership approval
    Given I am logged in as owner of public group "Open Forum"
    And membership approval is currently disabled
    When I enable membership approval
    Then new join requests should require moderator approval
    And existing members should not be affected
    And I should see "Membership approval enabled"

  Scenario: Owner configures join questions
    Given I am logged in as owner of private group "VIP Club"
    When I add join question "Why do you want to join?"
    And I add join question "How did you hear about us?"
    Then applicants should be required to answer these questions
    And moderators should see answers when reviewing requests
    And questions should be saved successfully

  Scenario: Owner removes join questions
    Given I am logged in as owner of private group "VIP Club"
    And there are currently 2 join questions
    When I remove all join questions
    Then applicants should not be asked any questions
    And moderators should see "No join questions configured"

  Scenario: Non-owner cannot configure join settings
    Given I am logged in as moderator of group "VIP Club"
    When I attempt to configure join questions
    Then the request should fail with status 403
    And I should see "Only the owner can configure join settings"
```

```gherkin
Feature: Notification Settings
  As a group member
  I want to configure my notification preferences
  So that I can control how I'm notified about group activity

  Scenario: Member configures personal notification preferences
    Given I am logged in as member of group "Active Forum"
    When I access notification settings
    And I disable "New post notifications"
    And I enable "Direct mention notifications"
    And I set frequency to "Daily digest"
    Then my preferences should be saved
    And I should only receive notifications based on these settings

  Scenario: Member enables real-time notifications
    Given I am logged in as member of group "Active Forum"
    When I set notification frequency to "Real-time"
    Then I should receive immediate notifications for relevant events
    And notifications should be delivered via: in-app, email, push (if enabled)

  Scenario: Member disables all group notifications
    Given I am logged in as member of group "Noisy Group"
    When I disable all notifications for this group
    Then I should not receive any notifications from this group
    But I should still be able to access group content
    And I should see "All notifications disabled for this group"

  Scenario: Owner configures default notification settings
    Given I am logged in as owner of group "New Community"
    When I set default notifications to "Daily digest"
    Then all new members should start with daily digest setting
    But existing members should keep their current settings
    And members can still override defaults with personal preferences

  Scenario: Member receives mention notifications even when others disabled
    Given I am logged in as member of group "Discussion Forum"
    And I have disabled "New post notifications"
    But I have enabled "Direct mention notifications"
    When "john@example.com" mentions me in a post
    Then I should receive a notification about the mention
    And the notification should link to the specific post

  Scenario: Non-owner cannot change default group notifications
    Given I am logged in as moderator of group "Discussion Forum"
    When I attempt to change default notification settings
    Then the request should fail with status 403
    And I should see "Only the owner can change default settings"
```

---

### 4.6 Role Transition Test Scenarios

```gherkin
Feature: Role Transitions
  As a system administrator
  I want to ensure proper permission handling during role transitions
  So that users always have appropriate access levels

  Scenario: Member promoted to moderator gains permissions immediately
    Given "member@example.com" is a regular member of group "Test Group"
    And the member can only perform basic member actions
    When the owner promotes the member to moderator
    And the member accepts the role
    Then the member should immediately gain moderator permissions
    And the member should be able to approve member requests
    And the member should be able to delete other members' posts
    And the action should be logged

  Scenario: Moderator demoted to member loses permissions immediately
    Given "moderator@example.com" is a moderator of group "Test Group"
    And the moderator can perform moderation actions
    When the owner demotes the moderator to member
    Then the user should immediately lose moderator permissions
    And the user should no longer see the moderation queue
    And the user should not be able to delete other members' posts
    And any ongoing moderation actions should be cancelled

  Scenario: Owner transfers ownership and becomes moderator
    Given "owner@example.com" is the owner of group "Test Group"
    And "newowner@example.com" is a member
    When "owner@example.com" transfers ownership to "newowner@example.com"
    And "newowner@example.com" accepts the transfer
    Then "newowner@example.com" should become the new owner
    And "owner@example.com" should become a moderator
    And "newowner@example.com" should gain all owner permissions
    And "owner@example.com" should lose owner-only permissions
    And all members should be notified of the change

  Scenario: Moderator becomes owner through transfer
    Given "moderator@example.com" is a moderator of group "Test Group"
    And "owner@example.com" is the current owner
    When "owner@example.com" transfers ownership to "moderator@example.com"
    And "moderator@example.com" accepts the transfer
    Then "moderator@example.com" should gain owner permissions
    And "moderator@example.com" should retain moderator permissions (inherited)
    And "owner@example.com" should become a moderator

  Scenario: Member directly promoted to owner
    Given "member@example.com" is a regular member of group "Test Group"
    And "owner@example.com" is the current owner
    When "owner@example.com" transfers ownership to "member@example.com"
    And "member@example.com" accepts the transfer
    Then "member@example.com" should become the owner
    And "member@example.com" should gain all owner and moderator permissions
    And "owner@example.com" should become a moderator

  Scenario: Permission check after rapid role changes
    Given "user@example.com" is a member of group "Test Group"
    When the owner promotes the user to moderator
    And the user accepts moderator role
    And 1 minute later the owner revokes moderator role
    Then the user should be a regular member
    And the user should have only member permissions
    And all permission checks should accurately reflect current role
    And the role history should be logged

  Scenario: Concurrent permission checks during role transition
    Given "moderator@example.com" is being demoted to member
    And the role transition is in progress
    When the user attempts to perform a moderator action during transition
    Then the system should use the NEW role for authorization
    And the action should be denied if it requires moderator role
    And the user should see an appropriate error message
```

---

### 4.7 Edge Cases & Security Test Scenarios

```gherkin
Feature: Permission Bypass Prevention
  As a security engineer
  I want to prevent permission bypass attacks
  So that authorization cannot be circumvented

  Scenario: Cannot manipulate request to bypass role check
    Given I am logged in as member of group "Secure Group"
    When I attempt to approve a membership request
    And I manipulate the request to claim moderator role
    Then the request should fail with status 403
    And the server should verify my actual role
    And the attempt should be logged as suspicious

  Scenario: Cannot escalate privileges through API manipulation
    Given I am logged in as member of group "Secure Group"
    When I attempt to directly call the "assign moderator" API
    And I specify myself as the target
    Then the request should fail with status 403
    And the server should verify I am not the owner
    And the attempt should be logged

  Scenario: Cannot perform actions on behalf of another user
    Given I am logged in as "attacker@example.com"
    And I am a moderator of group "Secure Group"
    When I attempt to delete a post
    And I manipulate the request to attribute the action to the owner
    Then the request should fail
    And the action should be attributed to me only
    And my account should be flagged for review

  Scenario: Race condition in role assignment
    Given I am logged in as owner of group "Test Group"
    And I initiate role assignment for "user@example.com"
    When I send two simultaneous requests to assign moderator role
    Then only one request should succeed
    And the system should prevent duplicate role assignments
    And the response should indicate the role was already assigned

  Scenario: Token replay attack prevention
    Given I am logged in as moderator of group "Secure Group"
    And I delete a post with a valid authorization token
    When I replay the same request with the same token
    Then the request should be rejected
    And I should see "Request has already been processed"
    And the system should use nonce or timestamp validation

  Scenario: Permission check on archived group
    Given I am a member of archived group "Old Group"
    And I was able to post before archiving
    When I attempt to create a post after archiving
    Then the request should fail with status 403
    And I should see "This group is archived"
    And the permission check should evaluate archive status first

  Scenario: Soft-deleted content cannot be accessed
    Given a post was soft-deleted 10 days ago
    When I attempt to view the post directly via URL
    Then the request should fail with status 404
    And the content should not be visible
    And only authorized users (moderators/admins) should see "Content deleted"

  Scenario: Cannot ban yourself
    Given I am logged in as moderator of group "Test Group"
    When I attempt to ban myself
    Then the request should fail with status 400
    And I should see "You cannot ban yourself"

  Scenario: Cannot remove yourself as member
    Given I am logged in as member of group "Test Group"
    When I attempt to remove myself using the "remove member" API
    Then the request should fail with status 400
    And I should see "Use 'Leave Group' instead"

  Scenario: Owner cannot remove themselves
    Given I am logged in as owner of group "Test Group"
    When I attempt to remove myself as a member
    Then the request should fail with status 400
    And I should see "Transfer ownership before leaving"

  Scenario: Expired mute does not affect permissions
    Given "user@example.com" was muted for 1 hour
    And the mute expired 10 minutes ago
    When the user attempts to create a post
    Then the request should succeed
    And the system should verify the mute has expired
    And the post should be published

  Scenario: Cannot moderate while being moderated
    Given I am logged in as moderator "mod1@example.com"
    And another moderator "mod2@example.com" is attempting to mute me
    When I try to perform moderation actions during the muting process
    Then my actions should succeed until the mute is finalized
    But once muted, I should lose the ability to moderate
    And I should see "Your moderation privileges have been suspended"
```

---

## 5. API Authorization Rules

### 5.1 API Endpoint Mapping

| HTTP Method | Endpoint | Required Role | Permission | Success | Denied |
|-------------|----------|---------------|------------|---------|--------|
| **Group Management** |
| POST | /api/groups | Any authenticated user | create_group | 201 | 403 |
| PATCH | /api/groups/:id/name | Owner | edit_group_name | 200 | 403 |
| PATCH | /api/groups/:id/description | Owner, Moderator | edit_group_description | 200 | 403 |
| DELETE | /api/groups/:id | Owner | delete_group | 204 | 403 |
| POST | /api/groups/:id/archive | Owner | archive_group | 200 | 403 |
| DELETE | /api/groups/:id/archive | Owner | unarchive_group | 200 | 403 |
| POST | /api/groups/:id/transfer | Owner | transfer_ownership | 200 | 403 |
| POST | /api/groups/:id/export | Owner | export_group_data | 200 | 403 |
| **Privacy Settings** |
| PATCH | /api/groups/:id/privacy | Owner | change_privacy | 200 | 403 |
| PATCH | /api/groups/:id/settings/approval | Owner | configure_post_approval | 200 | 403 |
| PATCH | /api/groups/:id/settings/member-approval | Owner | configure_member_approval | 200 | 403 |
| **Member Management** |
| GET | /api/groups/:id/members | Member+ | view_members | 200 | 403 |
| POST | /api/groups/:id/invite | Owner, Moderator, Member* | invite_member | 201 | 403 |
| POST | /api/groups/:id/members/:userId/approve | Owner, Moderator | approve_member | 200 | 403 |
| DELETE | /api/groups/:id/members/:userId/requests | Owner, Moderator | reject_member_request | 204 | 403 |
| DELETE | /api/groups/:id/members/:userId | Owner, Moderator** | remove_member | 204 | 403 |
| POST | /api/groups/:id/members/:userId/ban | Owner, Moderator** | ban_member | 200 | 403 |
| DELETE | /api/groups/:id/members/:userId/ban | Owner, Moderator | unban_member | 204 | 403 |
| POST | /api/groups/:id/members/:userId/mute | Owner, Moderator** | mute_member | 200 | 403 |
| DELETE | /api/groups/:id/members/:userId/mute | Owner, Moderator | unmute_member | 204 | 403 |
| POST | /api/groups/:id/moderators/:userId | Owner | assign_moderator | 201 | 403 |
| DELETE | /api/groups/:id/moderators/:userId | Owner | revoke_moderator | 204 | 403 |
| DELETE | /api/groups/:id/members/me | Member, Moderator | leave_group | 204 | 403*** |
| **Content Management** |
| POST | /api/groups/:id/posts | Member+ | create_post | 201 | 403 |
| PATCH | /api/groups/:id/posts/:postId | Author, Owner, Moderator | edit_post | 200 | 403 |
| DELETE | /api/groups/:id/posts/:postId | Author, Owner, Moderator | delete_post | 204 | 403 |
| POST | /api/groups/:id/posts/:postId/pin | Owner, Moderator | pin_post | 200 | 403 |
| DELETE | /api/groups/:id/posts/:postId/pin | Owner, Moderator | unpin_post | 204 | 403 |
| POST | /api/groups/:id/posts/:postId/comments | Member+ | comment_on_post | 201 | 403 |
| PATCH | /api/groups/:id/posts/:postId/comments/:commentId | Author, Owner, Moderator | edit_comment | 200 | 403 |
| DELETE | /api/groups/:id/posts/:postId/comments/:commentId | Author, Owner, Moderator | delete_comment | 204 | 403 |
| POST | /api/groups/:id/posts/:postId/reactions | Member+ | react_to_post | 201 | 403 |
| POST | /api/groups/:id/posts/:postId/share | Member+ | share_post | 201 | 403 |
| **Moderation** |
| GET | /api/groups/:id/posts/pending | Owner, Moderator | view_pending_posts | 200 | 403 |
| POST | /api/groups/:id/posts/:postId/approve | Owner, Moderator | approve_post | 200 | 403 |
| DELETE | /api/groups/:id/posts/:postId/pending | Owner, Moderator | reject_post | 204 | 403 |
| GET | /api/groups/:id/reports | Owner, Moderator | view_reports | 200 | 403 |
| POST | /api/groups/:id/reports | Member+ | report_content | 201 | 403 |
| POST | /api/groups/:id/reports/:reportId/action | Owner, Moderator | action_report | 200 | 403 |
| GET | /api/groups/:id/moderation-logs | Owner, Moderator | view_moderation_logs | 200 | 403 |
| GET | /api/groups/:id/audit-trail | Owner | view_audit_trail | 200 | 403 |
| **Notifications** |
| PATCH | /api/groups/:id/members/me/notifications | Member+ | configure_own_notifications | 200 | 403 |
| PATCH | /api/groups/:id/settings/notifications | Owner | configure_group_notifications | 200 | 403 |

**Legend:**
- Member+ = Member, Moderator, or Owner
- * = Conditional based on group settings
- ** = Cannot perform on Owner or other Moderators
- *** = Owner returns 400, not 403

---

### 5.2 Authorization Flow

```
1. Request received
   ↓
2. Authenticate user (verify JWT token)
   ↓
3. Extract user ID from token
   ↓
4. Query user's role in the group
   ↓
5. Check if group is archived (fail certain operations)
   ↓
6. Check if user is muted (fail posting/commenting)
   ↓
7. Check if user is banned (fail all operations)
   ↓
8. Verify role has required permission
   ↓
9. Apply special rules (cannot moderate Owner, etc.)
   ↓
10. Execute operation or return 403
```

---

### 5.3 Error Response Format

```json
{
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "You do not have permission to perform this action",
    "details": {
      "required_role": "moderator",
      "current_role": "member",
      "action": "approve_member_request"
    },
    "timestamp": "2025-12-04T10:30:00Z",
    "request_id": "req_abc123"
  }
}
```

---

### 5.4 Special HTTP Status Codes

| Status Code | Usage | Example |
|-------------|-------|---------|
| 200 | Successful operation | Successfully updated group description |
| 201 | Resource created | New group created, new member added |
| 204 | Successful deletion | Member removed, post deleted |
| 400 | Invalid request | Cannot remove yourself, invalid group name |
| 401 | Not authenticated | Missing or invalid JWT token |
| 403 | Permission denied | Regular member attempts to ban another member |
| 404 | Resource not found | Group doesn't exist, post deleted |
| 409 | Conflict | Group name already exists, user already a member |
| 429 | Rate limit exceeded | Too many reports, too many group creations |
| 500 | Server error | Database failure, unexpected error |

---

## 6. Audit Requirements

### 6.1 Audit Event Types

All significant actions must be logged to the audit trail with the following information:

**Required Fields:**
- `event_id` (UUID)
- `event_type` (string)
- `actor_id` (user ID who performed the action)
- `actor_role` (role at time of action)
- `group_id` (group where action occurred)
- `timestamp` (ISO 8601 format)
- `ip_address` (actor's IP address)
- `user_agent` (actor's browser/app)

**Optional Fields (based on event type):**
- `target_user_id` (for actions affecting another user)
- `target_resource_id` (post ID, comment ID, etc.)
- `old_value` (for updates)
- `new_value` (for updates)
- `reason` (for moderation actions)
- `additional_data` (JSON object with event-specific data)

---

### 6.2 Events Requiring Audit Logging

| Event Type | Trigger | Retention |
|------------|---------|-----------|
| group_created | Group creation | Permanent |
| group_deleted | Group soft/hard deletion | Permanent |
| group_archived | Group archived | 2 years |
| group_privacy_changed | Privacy setting changed | 2 years |
| ownership_transferred | Ownership transferred | Permanent |
| moderator_assigned | Moderator role assigned | 2 years |
| moderator_revoked | Moderator role revoked | 2 years |
| member_invited | Member invitation sent | 1 year |
| member_approved | Membership request approved | 1 year |
| member_rejected | Membership request rejected | 1 year |
| member_removed | Member removed by moderator | 2 years |
| member_banned | Member banned | 2 years |
| member_unbanned | Member unbanned | 2 years |
| member_muted | Member muted | 1 year |
| member_unmuted | Member unmuted | 1 year |
| member_left | Member voluntarily left | 1 year |
| post_created | Post created | 1 year |
| post_edited | Post edited (by author or mod) | 1 year |
| post_deleted | Post deleted | 2 years |
| post_approved | Post approved by moderator | 1 year |
| post_rejected | Post rejected by moderator | 1 year |
| post_pinned | Post pinned | 1 year |
| post_unpinned | Post unpinned | 1 year |
| comment_deleted | Comment deleted by moderator | 1 year |
| content_reported | Content reported | 2 years |
| report_actioned | Report reviewed and actioned | 2 years |
| settings_changed | Group settings changed | 2 years |
| permission_denied | Authorization failure | 6 months |
| suspicious_activity | Potential attack detected | 2 years |

---

### 6.3 Audit Log Access

**Who Can Access:**
- Owner: Full audit trail (all events)
- Moderator: Moderation logs (subset of events)
- System Administrators: Full audit trail for compliance

**Access Methods:**
- Web UI (view and filter)
- API endpoint (`GET /api/groups/:id/audit-trail`)
- CSV export (for compliance)

**Security:**
- Logs are append-only (cannot be edited or deleted)
- Logs are cryptographically signed to detect tampering
- Access to logs is itself logged

---

### 6.4 Compliance & Retention

**GDPR Compliance:**
- User can request export of all audit logs mentioning them
- Logs containing personal data are anonymized after retention period
- Right to be forgotten applies: user IDs can be pseudonymized

**Data Retention:**
- Moderation logs: 2 years minimum (regulatory requirement)
- Audit trail: 7 years for compliance (configurable)
- Real-time logs: 90 days in hot storage, then archived

**Backup & Recovery:**
- Audit logs backed up daily
- Backup retention: 7 years
- Point-in-time recovery available for 90 days

---

## 7. Implementation Guidelines

### 7.1 Database Schema Recommendations

**Groups Table:**
```sql
CREATE TABLE groups (
  id UUID PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  privacy ENUM('public', 'private') DEFAULT 'public',
  status ENUM('active', 'archived', 'deleted') DEFAULT 'active',
  owner_id UUID REFERENCES users(id),
  require_post_approval BOOLEAN DEFAULT FALSE,
  require_member_approval BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL
);
```

**Group Members Table:**
```sql
CREATE TABLE group_members (
  id UUID PRIMARY KEY,
  group_id UUID REFERENCES groups(id),
  user_id UUID REFERENCES users(id),
  role ENUM('owner', 'moderator', 'member') DEFAULT 'member',
  status ENUM('active', 'muted', 'banned') DEFAULT 'active',
  muted_until TIMESTAMP NULL,
  banned_until TIMESTAMP NULL,
  ban_reason TEXT NULL,
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);
```

**Audit Logs Table:**
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  actor_id UUID REFERENCES users(id),
  actor_role VARCHAR(20),
  group_id UUID REFERENCES groups(id),
  target_user_id UUID REFERENCES users(id) NULL,
  target_resource_id UUID NULL,
  old_value JSONB NULL,
  new_value JSONB NULL,
  reason TEXT NULL,
  additional_data JSONB NULL,
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMP DEFAULT NOW(),
  signature TEXT NOT NULL
);

CREATE INDEX idx_audit_logs_group ON audit_logs(group_id, timestamp DESC);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id, timestamp DESC);
```

---

### 7.2 Authorization Middleware (Pseudocode)

```javascript
async function checkGroupPermission(req, res, next) {
  const { groupId } = req.params;
  const userId = req.user.id;
  const action = req.permission; // Set by route handler

  // 1. Get user's role in the group
  const membership = await GroupMember.findOne({
    where: { groupId, userId, status: 'active' }
  });

  if (!membership) {
    return res.status(403).json({ error: 'Not a member of this group' });
  }

  // 2. Check if group is archived
  const group = await Group.findByPk(groupId);
  if (group.status === 'archived' && !['view', 'leave'].includes(action)) {
    return res.status(403).json({ error: 'Group is archived' });
  }

  // 3. Check if user is muted
  if (membership.status === 'muted' && ['post', 'comment'].includes(action)) {
    if (membership.muted_until > new Date()) {
      return res.status(403).json({
        error: 'You are muted',
        muted_until: membership.muted_until
      });
    } else {
      // Auto-expire mute
      await membership.update({ status: 'active', muted_until: null });
    }
  }

  // 4. Check if user is banned
  if (membership.status === 'banned') {
    if (!membership.banned_until || membership.banned_until > new Date()) {
      return res.status(403).json({ error: 'You are banned from this group' });
    } else {
      // Auto-expire ban
      await membership.update({ status: 'active', banned_until: null });
    }
  }

  // 5. Check role-based permissions
  const hasPermission = PERMISSIONS[action].includes(membership.role);
  if (!hasPermission) {
    await logAuditEvent({
      event_type: 'permission_denied',
      actor_id: userId,
      actor_role: membership.role,
      group_id: groupId,
      additional_data: { action, required_roles: PERMISSIONS[action] }
    });

    return res.status(403).json({
      error: 'Insufficient permissions',
      required_role: PERMISSIONS[action][0],
      current_role: membership.role
    });
  }

  // 6. Apply special rules for member management
  if (['remove', 'ban', 'mute'].includes(action)) {
    const { targetUserId } = req.params;
    const targetMembership = await GroupMember.findOne({
      where: { groupId, userId: targetUserId }
    });

    // Moderators cannot target Owner or other Moderators
    if (membership.role === 'moderator' &&
        ['owner', 'moderator'].includes(targetMembership.role)) {
      return res.status(403).json({
        error: 'Cannot perform this action on owner or moderators'
      });
    }
  }

  // Store membership in request for use in handler
  req.membership = membership;
  req.group = group;
  next();
}
```

---

### 7.3 Permission Constants

```javascript
const PERMISSIONS = {
  // Group Management
  create_group: ['owner', 'moderator', 'member'], // Any authenticated user
  edit_group_name: ['owner'],
  edit_group_description: ['owner', 'moderator'],
  delete_group: ['owner'],
  archive_group: ['owner'],
  transfer_ownership: ['owner'],

  // Member Management
  view_members: ['owner', 'moderator', 'member'],
  invite_member: ['owner', 'moderator', 'member'], // Check settings
  approve_member: ['owner', 'moderator'],
  remove_member: ['owner', 'moderator'], // Check target role
  ban_member: ['owner', 'moderator'], // Check target role
  mute_member: ['owner', 'moderator'], // Check target role
  assign_moderator: ['owner'],
  revoke_moderator: ['owner'],
  leave_group: ['member', 'moderator'], // Not owner

  // Content Management
  create_post: ['owner', 'moderator', 'member'],
  edit_own_post: ['owner', 'moderator', 'member'],
  edit_any_post: ['owner', 'moderator'],
  delete_own_post: ['owner', 'moderator', 'member'],
  delete_any_post: ['owner', 'moderator'],
  pin_post: ['owner', 'moderator'],
  comment_on_post: ['owner', 'moderator', 'member'],

  // Moderation
  approve_post: ['owner', 'moderator'],
  view_reports: ['owner', 'moderator'],
  action_report: ['owner', 'moderator'],
  report_content: ['owner', 'moderator', 'member'],
  view_moderation_logs: ['owner', 'moderator'],
  view_audit_trail: ['owner'],

  // Settings
  change_privacy: ['owner'],
  configure_post_approval: ['owner'],
  configure_notifications: ['owner'],
};
```

---

### 7.4 Testing Strategy

**Unit Tests:**
- Test each permission check in isolation
- Test role inheritance
- Test edge cases (muted, banned, archived)
- Test special rules (cannot ban owner)

**Integration Tests:**
- Test complete API workflows
- Test role transitions
- Test concurrent operations
- Test audit logging

**Security Tests:**
- Test for permission bypass attempts
- Test for privilege escalation
- Test for race conditions
- Test for token replay attacks

**Performance Tests:**
- Test permission checks under load
- Test audit logging throughput
- Test query optimization for role checks

---

### 7.5 Migration Plan

**Phase 1: Database Schema**
- Create groups, group_members, audit_logs tables
- Create indexes for performance
- Set up audit log signing mechanism

**Phase 2: Authentication & Authorization**
- Implement JWT authentication
- Implement role-based authorization middleware
- Implement permission checking logic

**Phase 3: Core RBAC Features**
- Implement role assignment/revocation
- Implement member management
- Implement content management with role checks

**Phase 4: Moderation Features**
- Implement muting and banning
- Implement post approval queue
- Implement reporting system

**Phase 5: Audit & Compliance**
- Implement comprehensive audit logging
- Implement log retention policies
- Implement export functionality

**Phase 6: Testing & Validation**
- Run all 60+ BDD test scenarios
- Perform security audit
- Load testing with permission checks

---

## 8. Acceptance Criteria

This specification is complete and ready for implementation when:

- [ ] All 3 roles are clearly defined with inheritance rules
- [ ] All 60+ permissions are documented in the matrix
- [ ] All 60+ BDD test scenarios pass
- [ ] All API endpoints have authorization rules mapped
- [ ] Audit logging is implemented for all critical events
- [ ] Security tests pass (no permission bypass vulnerabilities)
- [ ] Performance tests pass (permission checks <10ms)
- [ ] Documentation is complete and approved by stakeholders
- [ ] Code review completed by security team

---

## 9. Glossary

**Owner:** The highest-level role with complete control over the group. Only one owner per group.

**Moderator:** A trusted member with elevated permissions to manage content and members, but cannot change group settings or assign roles.

**Member:** The base role for all group participants with standard content creation and interaction permissions.

**Soft Delete:** Marking content as deleted but retaining it in the database for a grace period before permanent deletion.

**Hard Delete:** Permanent removal of content from the database with no recovery option.

**Mute:** Temporarily preventing a user from posting or commenting while maintaining their ability to view content.

**Ban:** Preventing a user from accessing the group entirely, either temporarily or permanently.

**Post Approval:** A moderation feature requiring posts to be reviewed and approved before becoming visible to all members.

**Audit Trail:** A comprehensive log of all significant group events for compliance and security purposes.

**Grace Period:** A time window (e.g., 30 days) during which soft-deleted content can be recovered.

---

## Document Control

**Author:** SPARC Specification Agent
**Reviewers:** Product Owner, Engineering Lead, Security Team, QE Team
**Approval Date:** Pending
**Next Review Date:** Upon implementation completion
**Version History:**
- v1.0.0 (2025-12-04): Initial specification

---

**END OF SPECIFICATION**
