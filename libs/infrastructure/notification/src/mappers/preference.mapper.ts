import { UserId, Timestamp } from '@csn/domain-shared';
import {
  Preference,
  PreferenceId,
  DeliveryChannel,
} from '@csn/domain-notification';
import { AggregateMapper } from '@csn/infra-shared';
import { PreferenceEntity } from '../entities/preference.entity';

/**
 * Maps between the Preference domain aggregate and the PreferenceEntity persistence model.
 * Uses Preference.reconstitute() for safe, compile-time-checked domain reconstruction.
 *
 * The channelPreferences Map<string, DeliveryChannel[]> is serialized to/from a
 * plain JSON object stored in a jsonb column.
 */
export class PreferenceMapper
  implements AggregateMapper<Preference, PreferenceEntity>
{
  toDomain(raw: PreferenceEntity): Preference {
    // Reconstitute the Map from the jsonb object
    const channelMap = new Map<string, DeliveryChannel[]>();
    if (raw.channelPreferences) {
      for (const [key, channels] of Object.entries(raw.channelPreferences)) {
        channelMap.set(
          key,
          (channels as string[]).map((ch) => ch as DeliveryChannel),
        );
      }
    }

    return Preference.reconstitute(
      PreferenceId.create(raw.id),
      UserId.create(raw.memberId),
      channelMap,
      raw.mutedUntil ? Timestamp.fromDate(raw.mutedUntil) : null,
      raw.version,
    );
  }

  toPersistence(domain: Preference): PreferenceEntity {
    const entity = new PreferenceEntity();
    entity.id = domain.id.value;
    entity.memberId = domain.memberId.value;

    // Serialize the Map to a plain object for jsonb storage
    const channelObj: Record<string, string[]> = {};
    for (const [key, channels] of domain.channelPreferences.entries()) {
      channelObj[key] = channels.map((ch) => ch as string);
    }
    entity.channelPreferences = channelObj;

    entity.mutedUntil = domain.mutedUntil ? domain.mutedUntil.value : null;
    entity.version = domain.version;
    return entity;
  }
}
