import { Inject, Injectable } from '@nestjs/common';
import { IPreferenceRepository, Preference } from '@csn/domain-notification';
import { UserId } from '@csn/domain-shared';
import { PREFERENCE_REPOSITORY_TOKEN } from '@csn/infra-notification';
import { PreferenceResponseDto } from '../dto/preference-response.dto';
import { GetPreferencesQuery } from './get-preferences.query';

@Injectable()
export class GetPreferencesHandler {
  constructor(
    @Inject(PREFERENCE_REPOSITORY_TOKEN)
    private readonly preferenceRepository: IPreferenceRepository,
  ) {}

  async execute(query: GetPreferencesQuery): Promise<PreferenceResponseDto> {
    const memberId = UserId.create(query.memberId);
    let preference = await this.preferenceRepository.findByMemberId(memberId);

    // If no preferences exist, create defaults
    if (!preference) {
      const prefId = this.preferenceRepository.nextId();
      preference = Preference.create(prefId, memberId);
      await this.preferenceRepository.save(preference);
    }

    return PreferenceResponseDto.fromDomain(preference);
  }
}
