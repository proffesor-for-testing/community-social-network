export class UploadAvatarCommand {
  constructor(
    public readonly profileId: string,
    public readonly requesterId: string,
    public readonly file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
  ) {}
}
