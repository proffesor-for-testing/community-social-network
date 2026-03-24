import { Connection } from '@csn/domain-social-graph';

export class ConnectionResponseDto {
  id: string;
  followerId: string;
  followeeId: string;
  status: string;
  createdAt: string;

  public static fromDomain(connection: Connection): ConnectionResponseDto {
    const dto = new ConnectionResponseDto();
    dto.id = connection.id.value;
    dto.followerId = connection.followerId.value;
    dto.followeeId = connection.followeeId.value;
    dto.status = connection.status.value;
    dto.createdAt = connection.createdAt.value.toISOString();
    return dto;
  }
}
