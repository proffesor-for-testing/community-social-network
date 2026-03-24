import { ApiProperty } from '@nestjs/swagger';
import { Preference } from '@csn/domain-notification';

export class PreferenceResponseDto {
  @ApiProperty({ description: 'Preference ID (UUID)', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ description: 'Member ID (UUID)', example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901' })
  memberId: string;

  @ApiProperty({
    description: 'Map of alert type to enabled delivery channels',
    example: {
      FOLLOW: ['IN_APP', 'EMAIL'],
      LIKE: ['IN_APP'],
    },
  })
  preferences: Record<string, string[]>;

  public static fromDomain(preference: Preference): PreferenceResponseDto {
    const dto = new PreferenceResponseDto();
    dto.id = preference.id.value;
    dto.memberId = preference.memberId.value;

    const prefs: Record<string, string[]> = {};
    for (const [alertType, channels] of preference.channelPreferences) {
      prefs[alertType] = channels.map((c) => c.toString());
    }
    dto.preferences = prefs;

    return dto;
  }
}
