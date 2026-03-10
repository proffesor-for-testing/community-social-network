import { AggregateRoot, UserId, Timestamp, ValidationError } from '@csn/domain-shared';
import { MembershipId } from '../value-objects/membership-id';
import { GroupId } from '../value-objects/group-id';
import { MembershipRole, isHigherRole } from '../value-objects/membership-role';
import { Permission, isPermissionGrantedTo } from '../value-objects/permission';
import { MemberJoinedGroupEvent } from '../events/member-joined-group.event';
import { MemberLeftGroupEvent } from '../events/member-left-group.event';
import { MemberPromotedEvent } from '../events/member-promoted.event';
import { MemberKickedEvent } from '../events/member-kicked.event';
import { CannotPromoteToOwnerError } from '../errors/cannot-promote-to-owner.error';

export class Membership extends AggregateRoot<MembershipId> {
  private _groupId: GroupId;
  private _memberId: UserId;
  private _role: MembershipRole;
  private _joinedAt: Timestamp;

  private constructor(
    id: MembershipId,
    groupId: GroupId,
    memberId: UserId,
    role: MembershipRole,
    joinedAt: Timestamp,
  ) {
    super(id);
    this._groupId = groupId;
    this._memberId = memberId;
    this._role = role;
    this._joinedAt = joinedAt;
  }

  public static create(
    id: MembershipId,
    groupId: GroupId,
    memberId: UserId,
    role: MembershipRole,
  ): Membership {
    const membership = new Membership(
      id,
      groupId,
      memberId,
      role,
      Timestamp.now(),
    );

    membership.addDomainEvent(
      new MemberJoinedGroupEvent(id.value, {
        memberId: memberId.value,
        role,
      }),
    );
    membership.incrementVersion();

    return membership;
  }

  /**
   * Reconstitute a Membership from persistence without emitting events.
   */
  public static reconstitute(
    id: MembershipId,
    groupId: GroupId,
    memberId: UserId,
    role: MembershipRole,
    joinedAt: Timestamp,
    version: number,
  ): Membership {
    const membership = new Membership(id, groupId, memberId, role, joinedAt);
    membership.setVersion(version);
    return membership;
  }

  // -- Getters --

  public get groupId(): GroupId {
    return this._groupId;
  }

  public get memberId(): UserId {
    return this._memberId;
  }

  public get role(): MembershipRole {
    return this._role;
  }

  public get joinedAt(): Timestamp {
    return this._joinedAt;
  }

  // -- Commands --

  public promote(newRole: MembershipRole): void {
    if (newRole === MembershipRole.OWNER) {
      throw new CannotPromoteToOwnerError();
    }

    if (!isHigherRole(newRole, this._role)) {
      throw new ValidationError(
        `Cannot promote from ${this._role} to ${newRole}. New role must be higher.`,
      );
    }

    const previousRole = this._role;
    this._role = newRole;

    this.addDomainEvent(
      new MemberPromotedEvent(this.id.value, {
        memberId: this._memberId.value,
        fromRole: previousRole,
        toRole: newRole,
      }),
    );
    this.incrementVersion();
  }

  public demote(newRole: MembershipRole): void {
    if (this._role === MembershipRole.OWNER) {
      throw new ValidationError(
        'Cannot demote the OWNER. Use ownership transfer instead.',
      );
    }

    if (!isHigherRole(this._role, newRole)) {
      throw new ValidationError(
        `Cannot demote from ${this._role} to ${newRole}. New role must be lower.`,
      );
    }

    this._role = newRole;
    this.incrementVersion();
  }

  public leave(): void {
    if (this._role === MembershipRole.OWNER) {
      throw new ValidationError(
        'Owner cannot leave the group. Transfer ownership first.',
      );
    }

    this.addDomainEvent(
      new MemberLeftGroupEvent(this.id.value, {
        memberId: this._memberId.value,
      }),
    );
    this.incrementVersion();
  }

  public kick(kickedBy: string, reason: string): void {
    if (this._role === MembershipRole.OWNER) {
      throw new ValidationError('Cannot kick the group owner.');
    }

    this.addDomainEvent(
      new MemberKickedEvent(this.id.value, {
        memberId: this._memberId.value,
        kickedBy,
        reason,
      }),
    );
    this.incrementVersion();
  }

  public hasPermission(permission: Permission): boolean {
    return isPermissionGrantedTo(permission, this._role);
  }
}
