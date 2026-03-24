import { ApiProperty } from '@nestjs/swagger';
import { MemberResponseDto } from './member-response.dto';

export class AuthResponseDto {
  @ApiProperty({ description: 'JWT access token (short-lived)', example: 'eyJhbGciOiJIUzI1NiIs...' })
  accessToken!: string;

  @ApiProperty({ description: 'JWT refresh token (long-lived)', example: 'eyJhbGciOiJIUzI1NiIs...' })
  refreshToken!: string;

  @ApiProperty({ description: 'Authenticated member details', type: MemberResponseDto })
  member!: MemberResponseDto;
}
