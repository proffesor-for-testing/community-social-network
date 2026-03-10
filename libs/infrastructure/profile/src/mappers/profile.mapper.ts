import { AggregateMapper } from '@csn/infra-shared';
import { UserId, Timestamp } from '@csn/domain-shared';
import {
  Profile,
  ProfileId,
  DisplayName,
  Bio,
  AvatarId,
  Location,
  PrivacySettings,
  ProfileVisibility,
} from '@csn/domain-profile';
import { ProfileEntity } from '../entities/profile.entity';

export class ProfileMapper implements AggregateMapper<Profile, ProfileEntity> {
  toDomain(raw: ProfileEntity): Profile {
    return Profile.reconstitute(
      ProfileId.create(raw.id),
      UserId.create(raw.memberId),
      DisplayName.create(raw.displayName),
      raw.bio ? Bio.create(raw.bio) : Bio.empty(),
      raw.avatarId ? AvatarId.create(raw.avatarId) : AvatarId.none(),
      raw.location ? this.parseLocation(raw.location) : Location.empty(),
      PrivacySettings.create({
        profileVisibility: raw.visibility as ProfileVisibility,
        showEmail: raw.showEmail,
        showLocation: raw.showLocation,
      }),
      Timestamp.fromDate(raw.createdAt),
      Timestamp.fromDate(raw.updatedAt),
      raw.version,
    );
  }

  toPersistence(domain: Profile): ProfileEntity {
    const entity = new ProfileEntity();
    entity.id = domain.id.value;
    entity.memberId = domain.memberId.value;
    entity.displayName = domain.displayName.value;
    entity.bio = domain.bio.value || null;
    entity.avatarId = domain.avatarId.value;
    entity.location = domain.location.isEmpty
      ? null
      : domain.location.toString();
    entity.visibility = domain.privacySettings.profileVisibility;
    entity.showEmail = domain.privacySettings.showEmail;
    entity.showLocation = domain.privacySettings.showLocation;
    entity.createdAt = domain.createdAt.value;
    entity.updatedAt = domain.updatedAt.value;
    entity.version = domain.version;
    return entity;
  }

  private parseLocation(raw: string): Location {
    const parts = raw.split(', ');
    if (parts.length === 2) {
      return Location.create({ city: parts[0], country: parts[1] });
    }
    // Single value: could be city or country; treat as city
    return Location.create({ city: raw });
  }
}
