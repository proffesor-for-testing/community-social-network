import {
  AggregateRoot,
  UserId,
  Timestamp,
  ValidationError,
  CONTENT_LIMITS,
} from '@csn/domain-shared';
import { GroupId } from '../value-objects/group-id';
import { GroupName } from '../value-objects/group-name';
import { GroupDescription } from '../value-objects/group-description';
import { GroupSettings } from '../value-objects/group-settings';
import { GroupRule } from '../value-objects/group-rule';
import { GroupStatus } from '../value-objects/group-status';
import { GroupCreatedEvent } from '../events/group-created.event';
import { GroupSettingsUpdatedEvent } from '../events/group-settings-updated.event';
import { OwnershipTransferredEvent } from '../events/ownership-transferred.event';
import { MaxRulesExceededError } from '../errors/max-rules-exceeded.error';

export class Group extends AggregateRoot<GroupId> {
  private _name: GroupName;
  private _description: GroupDescription;
  private _ownerId: UserId;
  private _settings: GroupSettings;
  private _rules: GroupRule[];
  private _status: GroupStatus;
  private _memberCount: number;
  private _createdAt: Timestamp;

  private constructor(
    id: GroupId,
    name: GroupName,
    description: GroupDescription,
    ownerId: UserId,
    settings: GroupSettings,
    rules: GroupRule[],
    status: GroupStatus,
    memberCount: number,
    createdAt: Timestamp,
  ) {
    super(id);
    this._name = name;
    this._description = description;
    this._ownerId = ownerId;
    this._settings = settings;
    this._rules = [...rules];
    this._status = status;
    this._memberCount = memberCount;
    this._createdAt = createdAt;
  }

  public static create(
    id: GroupId,
    name: GroupName,
    description: GroupDescription,
    ownerId: UserId,
    settings?: GroupSettings,
  ): Group {
    const group = new Group(
      id,
      name,
      description,
      ownerId,
      settings ?? GroupSettings.defaults(),
      [],
      GroupStatus.ACTIVE,
      0,
      Timestamp.now(),
    );

    group.addDomainEvent(
      new GroupCreatedEvent(id.value, {
        name: name.value,
        creatorId: ownerId.value,
      }),
    );
    group.incrementVersion();

    return group;
  }

  /**
   * Reconstitute a Group from persistence without emitting events.
   */
  public static reconstitute(
    id: GroupId,
    name: GroupName,
    description: GroupDescription,
    ownerId: UserId,
    settings: GroupSettings,
    rules: GroupRule[],
    status: GroupStatus,
    memberCount: number,
    createdAt: Timestamp,
    version: number,
  ): Group {
    const group = new Group(
      id,
      name,
      description,
      ownerId,
      settings,
      rules,
      status,
      memberCount,
      createdAt,
    );
    group.setVersion(version);
    return group;
  }

  // -- Getters --

  public get name(): GroupName {
    return this._name;
  }

  public get description(): GroupDescription {
    return this._description;
  }

  public get ownerId(): UserId {
    return this._ownerId;
  }

  public get settings(): GroupSettings {
    return this._settings;
  }

  public get rules(): ReadonlyArray<GroupRule> {
    return [...this._rules];
  }

  public get status(): GroupStatus {
    return this._status;
  }

  public get memberCount(): number {
    return this._memberCount;
  }

  public get createdAt(): Timestamp {
    return this._createdAt;
  }

  // -- Commands --

  public updateSettings(settings: GroupSettings): void {
    this.assertActive();

    const changes: string[] = [];
    if (this._settings.isPublic !== settings.isPublic) {
      changes.push('isPublic');
    }
    if (this._settings.requireApproval !== settings.requireApproval) {
      changes.push('requireApproval');
    }
    if (this._settings.allowMemberPosts !== settings.allowMemberPosts) {
      changes.push('allowMemberPosts');
    }

    this._settings = settings;

    if (changes.length > 0) {
      this.addDomainEvent(
        new GroupSettingsUpdatedEvent(this.id.value, { changes }),
      );
      this.incrementVersion();
    }
  }

  public addRule(rule: GroupRule): void {
    this.assertActive();

    if (this._rules.length >= CONTENT_LIMITS.MAX_GROUP_RULES) {
      throw new MaxRulesExceededError(CONTENT_LIMITS.MAX_GROUP_RULES);
    }

    this._rules.push(rule);
    this.incrementVersion();
  }

  public removeRule(index: number): void {
    this.assertActive();

    if (index < 0 || index >= this._rules.length) {
      throw new ValidationError(
        `Rule index ${index} is out of bounds. Group has ${this._rules.length} rules.`,
      );
    }

    this._rules.splice(index, 1);
    this.incrementVersion();
  }

  public archive(): void {
    this.assertActive();
    this._status = GroupStatus.ARCHIVED;
    this.incrementVersion();
  }

  public transferOwnership(newOwnerId: UserId): void {
    this.assertActive();

    const previousOwnerId = this._ownerId;
    this._ownerId = newOwnerId;

    this.addDomainEvent(
      new OwnershipTransferredEvent(this.id.value, {
        fromOwnerId: previousOwnerId.value,
        toOwnerId: newOwnerId.value,
      }),
    );
    this.incrementVersion();
  }

  public incrementMemberCount(): void {
    this._memberCount++;
  }

  public decrementMemberCount(): void {
    if (this._memberCount > 0) {
      this._memberCount--;
    }
  }

  // -- Invariants --

  private assertActive(): void {
    if (this._status !== GroupStatus.ACTIVE) {
      throw new ValidationError(
        `Cannot modify group in ${this._status} status. Group must be ACTIVE.`,
      );
    }
  }
}
