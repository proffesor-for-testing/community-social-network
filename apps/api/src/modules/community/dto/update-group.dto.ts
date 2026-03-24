import { IsString, IsOptional, IsBoolean, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { GroupSettingsDto } from './create-group.dto';

export class UpdateGroupDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => GroupSettingsDto)
  settings?: GroupSettingsDto;
}
