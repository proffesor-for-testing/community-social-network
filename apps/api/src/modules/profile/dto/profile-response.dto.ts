import { Profile } from '@csn/domain-profile';

export class ProfileResponseDto {
  id: string;
  memberId: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  city: string | undefined;
  country: string | undefined;
  createdAt: string;
  updatedAt: string;

  public static fromDomain(profile: Profile): ProfileResponseDto {
    const dto = new ProfileResponseDto();
    dto.id = profile.id.value;
    dto.memberId = profile.memberId.value;
    dto.displayName = profile.displayName.value;
    dto.bio = profile.bio.value;
    dto.avatarUrl = profile.avatarId.value;
    dto.city = profile.location.city;
    dto.country = profile.location.country;
    dto.createdAt = profile.createdAt.value.toISOString();
    dto.updatedAt = profile.updatedAt.value.toISOString();
    return dto;
  }
}
