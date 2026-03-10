import { AggregateRoot, UserId, Email, Timestamp } from '@csn/domain-shared';
import { ProfileId } from '../value-objects/profile-id';
import { DisplayName } from '../value-objects/display-name';
import { Bio } from '../value-objects/bio';
import { AvatarId } from '../value-objects/avatar-id';
import { Location } from '../value-objects/location';
import { PrivacySettings } from '../value-objects/privacy-settings';
import { ProfileCreatedEvent } from '../events/profile-created.event';
import { ProfileUpdatedEvent } from '../events/profile-updated.event';
import { AvatarChangedEvent } from '../events/avatar-changed.event';

export class Profile extends AggregateRoot<ProfileId> {
  private _memberId: UserId;
  private _displayName: DisplayName;
  private _bio: Bio;
  private _avatarId: AvatarId;
  private _location: Location;
  private _privacySettings: PrivacySettings;
  private _createdAt: Timestamp;
  private _updatedAt: Timestamp;

  private constructor(
    id: ProfileId,
    memberId: UserId,
    displayName: DisplayName,
    bio: Bio,
    avatarId: AvatarId,
    location: Location,
    privacySettings: PrivacySettings,
    createdAt: Timestamp,
    updatedAt: Timestamp,
  ) {
    super(id);
    this._memberId = memberId;
    this._displayName = displayName;
    this._bio = bio;
    this._avatarId = avatarId;
    this._location = location;
    this._privacySettings = privacySettings;
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;
  }

  public static create(
    id: ProfileId,
    memberId: UserId,
    displayName: DisplayName,
    email: Email,
  ): Profile {
    const now = Timestamp.now();
    const profile = new Profile(
      id,
      memberId,
      displayName,
      Bio.empty(),
      AvatarId.none(),
      Location.empty(),
      PrivacySettings.default(),
      now,
      now,
    );

    profile.addDomainEvent(
      new ProfileCreatedEvent(id.value, displayName.value, email.value),
    );

    return profile;
  }

  /**
   * Reconstitute a Profile from persistence without emitting events.
   */
  public static reconstitute(
    id: ProfileId,
    memberId: UserId,
    displayName: DisplayName,
    bio: Bio,
    avatarId: AvatarId,
    location: Location,
    privacySettings: PrivacySettings,
    createdAt: Timestamp,
    updatedAt: Timestamp,
    version: number,
  ): Profile {
    const profile = new Profile(
      id,
      memberId,
      displayName,
      bio,
      avatarId,
      location,
      privacySettings,
      createdAt,
      updatedAt,
    );
    profile.setVersion(version);
    return profile;
  }

  // --- Getters ---

  public get memberId(): UserId {
    return this._memberId;
  }

  public get displayName(): DisplayName {
    return this._displayName;
  }

  public get bio(): Bio {
    return this._bio;
  }

  public get avatarId(): AvatarId {
    return this._avatarId;
  }

  public get location(): Location {
    return this._location;
  }

  public get privacySettings(): PrivacySettings {
    return this._privacySettings;
  }

  public get createdAt(): Timestamp {
    return this._createdAt;
  }

  public get updatedAt(): Timestamp {
    return this._updatedAt;
  }

  // --- Commands ---

  public updateDisplayName(name: DisplayName): void {
    this._displayName = name;
    this._updatedAt = Timestamp.now();
    this.incrementVersion();
    this.addDomainEvent(
      new ProfileUpdatedEvent(this.id.value, ['displayName']),
    );
  }

  public updateBio(bio: Bio): void {
    this._bio = bio;
    this._updatedAt = Timestamp.now();
    this.incrementVersion();
    this.addDomainEvent(
      new ProfileUpdatedEvent(this.id.value, ['bio']),
    );
  }

  public changeAvatar(avatarId: AvatarId): void {
    this._avatarId = avatarId;
    this._updatedAt = Timestamp.now();
    this.incrementVersion();
    this.addDomainEvent(
      new AvatarChangedEvent(this.id.value, avatarId.value),
    );
  }

  public removeAvatar(): void {
    this._avatarId = AvatarId.none();
    this._updatedAt = Timestamp.now();
    this.incrementVersion();
    this.addDomainEvent(
      new AvatarChangedEvent(this.id.value, null),
    );
  }

  public updateLocation(location: Location): void {
    this._location = location;
    this._updatedAt = Timestamp.now();
    this.incrementVersion();
    this.addDomainEvent(
      new ProfileUpdatedEvent(this.id.value, ['location']),
    );
  }

  public updatePrivacySettings(settings: PrivacySettings): void {
    this._privacySettings = settings;
    this._updatedAt = Timestamp.now();
    this.incrementVersion();
    this.addDomainEvent(
      new ProfileUpdatedEvent(this.id.value, ['privacySettings']),
    );
  }

  /**
   * Determines if this profile is visible to the given requester.
   *
   * - 'public' profiles are visible to everyone.
   * - 'connections_only' profiles are visible to connections and the owner.
   * - 'private' profiles are only visible to the owner.
   */
  public isVisibleTo(requesterId: UserId, isConnection: boolean): boolean {
    // Owner can always see their own profile
    if (this._memberId.equals(requesterId)) {
      return true;
    }

    switch (this._privacySettings.profileVisibility) {
      case 'public':
        return true;
      case 'connections_only':
        return isConnection;
      case 'private':
        return false;
      default:
        return false;
    }
  }
}
