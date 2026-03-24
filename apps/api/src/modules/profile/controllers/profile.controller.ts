import {
  Controller,
  Get,
  Put,
  Post,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Public, CurrentUser, AccessTokenPayload } from '@csn/infra-auth';

import { UpdateProfileDto } from '../dto/update-profile.dto';
import { ProfileResponseDto } from '../dto/profile-response.dto';
import { UploadAvatarResponseDto } from '../dto/upload-avatar.dto';

import { GetProfileHandler } from '../queries/get-profile.handler';
import { GetProfileQuery } from '../queries/get-profile.query';
import { GetProfileByMemberHandler } from '../queries/get-profile-by-member.handler';
import { GetProfileByMemberQuery } from '../queries/get-profile-by-member.query';
import { UpdateProfileHandler } from '../commands/update-profile.handler';
import { UpdateProfileCommand } from '../commands/update-profile.command';
import { UploadAvatarHandler } from '../commands/upload-avatar.handler';
import { UploadAvatarCommand } from '../commands/upload-avatar.command';

@Controller('api/profiles')
export class ProfileController {
  constructor(
    private readonly getProfileHandler: GetProfileHandler,
    private readonly getProfileByMemberHandler: GetProfileByMemberHandler,
    private readonly updateProfileHandler: UpdateProfileHandler,
    private readonly uploadAvatarHandler: UploadAvatarHandler,
  ) {}

  @Public()
  @Get(':id')
  async getProfile(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ProfileResponseDto> {
    return this.getProfileHandler.execute(new GetProfileQuery(id));
  }

  @Public()
  @Get('member/:memberId')
  async getProfileByMember(
    @Param('memberId', new ParseUUIDPipe()) memberId: string,
  ): Promise<ProfileResponseDto> {
    return this.getProfileByMemberHandler.execute(
      new GetProfileByMemberQuery(memberId),
    );
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProfileDto,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<ProfileResponseDto> {
    return this.updateProfileHandler.execute(
      new UpdateProfileCommand(
        id,
        user.userId,
        dto.displayName,
        dto.bio,
        dto.city,
        dto.country,
      ),
    );
  }

  @Post(':id/avatar')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<UploadAvatarResponseDto> {
    return this.uploadAvatarHandler.execute(
      new UploadAvatarCommand(id, user.userId, file),
    );
  }
}
