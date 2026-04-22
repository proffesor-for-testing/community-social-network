import { Profile } from '@csn/domain-profile';

export class ProfileResponseDto {
  id!: string;
  memberId!: string;
  displayName!: string;
  bio!: string;
  avatarUrl!: string | null;
  location!: string | null;
  website!: string | null;
  city?: string;
  country?: string;
  joinedAt!: string;
  createdAt!: string;
  updatedAt!: string;

  public static fromDomain(profile: Profile): ProfileResponseDto {
    const dto = new ProfileResponseDto();
    dto.id = profile.id.value;
    dto.memberId = profile.memberId.value;
    dto.displayName = profile.displayName.value;
    dto.bio = profile.bio.value;
    dto.avatarUrl = profile.avatarId.value;
    dto.city = profile.location.city;
    dto.country = profile.location.country;
    dto.location =
      [profile.location.city, profile.location.country].filter(Boolean).join(', ') || null;
    dto.website = null;
    const createdAtIso = profile.createdAt.value.toISOString();
    dto.joinedAt = createdAtIso;
    dto.createdAt = createdAtIso;
    dto.updatedAt = profile.updatedAt.value.toISOString();
    return dto;
  }
}
