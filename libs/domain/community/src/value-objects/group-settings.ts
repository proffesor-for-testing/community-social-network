import { ValueObject } from '@csn/domain-shared';

interface GroupSettingsProps {
  isPublic: boolean;
  requireApproval: boolean;
  allowMemberPosts: boolean;
}

export class GroupSettings extends ValueObject<GroupSettingsProps> {
  private constructor(props: GroupSettingsProps) {
    super(props);
  }

  public static create(props: GroupSettingsProps): GroupSettings {
    return new GroupSettings({
      isPublic: props.isPublic,
      requireApproval: props.requireApproval,
      allowMemberPosts: props.allowMemberPosts,
    });
  }

  public static defaults(): GroupSettings {
    return new GroupSettings({
      isPublic: true,
      requireApproval: false,
      allowMemberPosts: true,
    });
  }

  public get isPublic(): boolean {
    return this.props.isPublic;
  }

  public get requireApproval(): boolean {
    return this.props.requireApproval;
  }

  public get allowMemberPosts(): boolean {
    return this.props.allowMemberPosts;
  }
}
