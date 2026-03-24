import { ConnectionResponseDto } from './connection-response.dto';

export class PaginatedConnectionsDto {
  items: ConnectionResponseDto[];
  total: number;
  cursor: string | null;

  public static create(
    items: ConnectionResponseDto[],
    total: number,
    cursor: string | null = null,
  ): PaginatedConnectionsDto {
    const dto = new PaginatedConnectionsDto();
    dto.items = items;
    dto.total = total;
    dto.cursor = cursor;
    return dto;
  }
}
