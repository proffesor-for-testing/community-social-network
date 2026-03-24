import { ApiProperty } from '@nestjs/swagger';

export class UnreadCountResponseDto {
  @ApiProperty({ description: 'Number of unread notifications', example: 5 })
  count: number;

  public static of(count: number): UnreadCountResponseDto {
    const dto = new UnreadCountResponseDto();
    dto.count = count;
    return dto;
  }
}
