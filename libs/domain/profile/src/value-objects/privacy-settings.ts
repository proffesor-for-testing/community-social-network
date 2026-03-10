import { ValueObject, ValidationError } from '@csn/domain-shared';

export type ProfileVisibility = 'public' | 'private' | 'connections_only';

interface PrivacySettingsProps {
  profileVisibility: ProfileVisibility;
  showEmail: boolean;
  showLocation: boolean;
}

const VALID_VISIBILITIES: ProfileVisibility[] = [
  'public',
  'private',
  'connections_only',
];

export class PrivacySettings extends ValueObject<PrivacySettingsProps> {
  private constructor(props: PrivacySettingsProps) {
    super(props);
  }

  public static create(props: {
    profileVisibility: ProfileVisibility;
    showEmail: boolean;
    showLocation: boolean;
  }): PrivacySettings {
    if (!VALID_VISIBILITIES.includes(props.profileVisibility)) {
      throw new ValidationError(
        `Profile visibility must be one of: ${VALID_VISIBILITIES.join(', ')}`,
      );
    }

    return new PrivacySettings({
      profileVisibility: props.profileVisibility,
      showEmail: props.showEmail,
      showLocation: props.showLocation,
    });
  }

  public static default(): PrivacySettings {
    return new PrivacySettings({
      profileVisibility: 'public',
      showEmail: false,
      showLocation: true,
    });
  }

  public get profileVisibility(): ProfileVisibility {
    return this.props.profileVisibility;
  }

  public get showEmail(): boolean {
    return this.props.showEmail;
  }

  public get showLocation(): boolean {
    return this.props.showLocation;
  }
}
