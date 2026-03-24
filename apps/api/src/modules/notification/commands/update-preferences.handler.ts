import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import {
  AlertType,
  DeliveryChannel,
  IPreferenceRepository,
  Preference,
} from '@csn/domain-notification';
import { UserId } from '@csn/domain-shared';
import { PREFERENCE_REPOSITORY_TOKEN } from '@csn/infra-notification';
import { UpdatePreferencesCommand } from './update-preferences.command';

const VALID_ALERT_TYPES = new Set(Object.values(AlertType));
const VALID_CHANNELS = new Set(Object.values(DeliveryChannel));

@Injectable()
export class UpdatePreferencesHandler {
  constructor(
    @Inject(PREFERENCE_REPOSITORY_TOKEN)
    private readonly preferenceRepository: IPreferenceRepository,
  ) {}

  async execute(command: UpdatePreferencesCommand): Promise<void> {
    const memberId = UserId.create(command.memberId);

    // Validate the preferences input
    for (const [alertType, channels] of Object.entries(command.preferences)) {
      if (!VALID_ALERT_TYPES.has(alertType as AlertType)) {
        throw new BadRequestException(`Invalid alert type: ${alertType}`);
      }
      for (const channel of channels) {
        if (!VALID_CHANNELS.has(channel as DeliveryChannel)) {
          throw new BadRequestException(`Invalid delivery channel: ${channel}`);
        }
      }
    }

    // Find or create preferences for this member
    let preference = await this.preferenceRepository.findByMemberId(memberId);
    if (!preference) {
      const prefId = this.preferenceRepository.nextId();
      preference = Preference.create(prefId, memberId);
    }

    // Apply each preference update
    for (const [alertType, channels] of Object.entries(command.preferences)) {
      preference.setChannelsForType(
        alertType as AlertType,
        channels.map((c) => c as DeliveryChannel),
      );
    }

    await this.preferenceRepository.save(preference);
  }
}
