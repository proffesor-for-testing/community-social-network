import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsArray, IsEnum, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdatePreferencesDto {
  @ApiProperty({
    description: 'Map of alert type to enabled delivery channels',
    example: {
      FOLLOW: ['IN_APP', 'EMAIL'],
      LIKE: ['IN_APP'],
      COMMENT: ['IN_APP', 'EMAIL', 'PUSH'],
    },
  })
  @IsObject()
  preferences: Record<string, string[]>;
}
