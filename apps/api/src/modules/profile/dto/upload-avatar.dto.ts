/**
 * DTO describing the multipart avatar upload payload.
 * The actual file is extracted via @UploadedFile() + FileInterceptor in the controller.
 */
export class UploadAvatarDto {
  file: Express.Multer.File;
}

export class UploadAvatarResponseDto {
  avatarId: string;
  message: string;
}
