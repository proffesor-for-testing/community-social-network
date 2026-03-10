import { AggregateRoot, UserId, Timestamp } from '@csn/domain-shared';
import { PreferenceId } from '../value-objects/preference-id';
import { AlertType } from '../value-objects/alert-type';
import { DeliveryChannel } from '../value-objects/delivery-channel';
import { PreferencesUpdatedEvent } from '../events/preferences-updated.event';

export class Preference extends AggregateRoot<PreferenceId> {
  private _memberId: UserId;
  private _channelPreferences: Map<string, DeliveryChannel[]>;
  private _mutedUntil: Timestamp | null;

  private constructor(
    id: PreferenceId,
    memberId: UserId,
    channelPreferences: Map<string, DeliveryChannel[]>,
    mutedUntil: Timestamp | null = null,
  ) {
    super(id);
    this._memberId = memberId;
    this._channelPreferences = channelPreferences;
    this._mutedUntil = mutedUntil;
  }

  public static create(id: PreferenceId, memberId: UserId): Preference {
    const defaults = new Map<string, DeliveryChannel[]>();
    for (const alertType of Object.values(AlertType)) {
      defaults.set(alertType, [DeliveryChannel.IN_APP]);
    }

    const preference = new Preference(id, memberId, defaults);
    preference.incrementVersion();
    return preference;
  }

  /**
   * Reconstitute a Preference from persistence without emitting events.
   */
  public static reconstitute(
    id: PreferenceId,
    memberId: UserId,
    channelPreferences: Map<string, DeliveryChannel[]>,
    mutedUntil: Timestamp | null,
    version: number,
  ): Preference {
    const preference = new Preference(id, memberId, channelPreferences, mutedUntil);
    preference.setVersion(version);
    return preference;
  }

  public setChannelsForType(alertType: AlertType, channels: DeliveryChannel[]): void {
    this._channelPreferences.set(alertType, [...channels]);

    this.addDomainEvent(
      new PreferencesUpdatedEvent(
        this.id.value,
        channels.map((c) => c.toString()),
        this.version + 1,
      ),
    );
    this.incrementVersion();
  }

  public mute(until: Timestamp): void {
    this._mutedUntil = until;
    this.incrementVersion();
  }

  public unmute(): void {
    this._mutedUntil = null;
    this.incrementVersion();
  }

  public isMuted(): boolean {
    if (this._mutedUntil === null) {
      return false;
    }
    return this._mutedUntil.isAfter(Timestamp.now());
  }

  public getChannelsFor(alertType: AlertType): DeliveryChannel[] {
    const channels = this._channelPreferences.get(alertType);
    if (!channels) {
      return [DeliveryChannel.IN_APP];
    }
    return [...channels];
  }

  public get memberId(): UserId {
    return this._memberId;
  }

  public get channelPreferences(): Map<string, DeliveryChannel[]> {
    return new Map(this._channelPreferences);
  }

  public get mutedUntil(): Timestamp | null {
    return this._mutedUntil;
  }
}
