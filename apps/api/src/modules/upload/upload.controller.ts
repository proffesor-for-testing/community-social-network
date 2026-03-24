import {
  Controller,
  Post,
  Delete,
  Param,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { CurrentUser, AccessTokenPayload } from '@csn/infra-auth';
import {
  S3UploadService,
  ImageProcessorService,
  CdnUrlService,
  validateImageBuffer,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_AVATAR_TYPES,
  MAX_FILE_SIZES,
} from '@csn/infra-storage';

interface UploadedFileType {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

@ApiTags('File Upload')
@ApiBearerAuth()
@Controller('api/upload')
export class UploadController {
  constructor(
    private readonly s3Service: S3UploadService,
    private readonly imageProcessor: ImageProcessorService,
    private readonly cdnUrl: CdnUrlService,
  ) {}

  @Post('image')
  @HttpCode(HttpStatus.CREATED)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload an image' })
  @ApiResponse({ status: 201, description: 'Image uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file type or size' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @UploadedFile() file: UploadedFileType,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('No file provided');
    }

    const validation = validateImageBuffer(
      file.buffer,
      ALLOWED_IMAGE_TYPES,
      MAX_FILE_SIZES.IMAGE,
    );

    if (!validation.valid) {
      throw new BadRequestException(validation.error);
    }

    const result = await this.s3Service.upload(
      file.buffer,
      validation.mime!,
      `images/${user.userId}`,
    );

    return {
      key: result.key,
      url: this.cdnUrl.generateUrl(result.key),
      contentType: result.contentType,
      size: result.size,
    };
  }

  @Post('avatar')
  @HttpCode(HttpStatus.CREATED)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload avatar with auto-generated variants' })
  @ApiResponse({ status: 201, description: 'Avatar uploaded with variants' })
  @ApiResponse({ status: 400, description: 'Invalid file type or size' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @UploadedFile() file: UploadedFileType,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('No file provided');
    }

    const validation = validateImageBuffer(
      file.buffer,
      ALLOWED_AVATAR_TYPES,
      MAX_FILE_SIZES.AVATAR,
    );

    if (!validation.valid) {
      throw new BadRequestException(validation.error);
    }

    // Upload original
    const original = await this.s3Service.upload(
      file.buffer,
      validation.mime!,
      `avatars/${user.userId}`,
    );

    // Generate and upload variants
    const variants = await this.imageProcessor.generateVariants(
      file.buffer,
      validation.mime!,
    );

    const variantResults = [];
    for (const variant of variants) {
      const key = original.key.replace(
        /(\.[^.]+)$/,
        `${variant.suffix}$1`,
      );
      await this.s3Service.upload(variant.buffer, variant.contentType, key);
      variantResults.push({
        width: variant.width,
        url: this.cdnUrl.generateUrl(key),
      });
    }

    return {
      key: original.key,
      url: this.cdnUrl.generateUrl(original.key),
      contentType: original.contentType,
      size: original.size,
      variants: variantResults,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an uploaded file' })
  @ApiResponse({ status: 204, description: 'File deleted' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async deleteFile(
    @Param('id') fileKey: string,
    @CurrentUser() _user: AccessTokenPayload,
  ): Promise<void> {
    try {
      await this.s3Service.delete(fileKey);
    } catch {
      throw new NotFoundException('File not found or already deleted');
    }
  }
}
