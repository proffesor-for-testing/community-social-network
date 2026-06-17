import { Connection } from '@csn/domain-social-graph';

export class ConnectionResponseDto {
  id: string;
  followerId: string;
  followerName?: string;
  followerAvatarUrl?: string | null;
  followeeId: string;
  followeeName?: string;
  followeeAvatarUrl?: string | null;
  status: string;
  createdAt: string;

  public static fromDomain(
    connection: Connection,
    profiles?: {
      follower?: { displayName?: string; avatarUrl?: string | null };
      followee?: { displayName?: string; avatarUrl?: string | null };
    },
  ): ConnectionResponseDto {
    const dto = new ConnectionResponseDto();
    dto.id = connection.id.value;
    dto.followerId = connection.followerId.value;
    dto.followerName = profiles?.follower?.displayName;
    dto.followerAvatarUrl = profiles?.follower?.avatarUrl ?? null;
    dto.followeeId = connection.followeeId.value;
    dto.followeeName = profiles?.followee?.displayName;
    dto.followeeAvatarUrl = profiles?.followee?.avatarUrl ?? null;
    dto.status = connection.status.value;
    dto.createdAt = connection.createdAt.value.toISOString();
    return dto;
  }
}
