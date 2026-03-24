import {
  Controller,
  Post,
  Get,
  Put,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { IsEnum, IsBoolean, IsOptional, IsString, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { CurrentUser, AccessTokenPayload } from '@csn/infra-auth';
import {
  DataExportService,
  DataErasureService,
  ConsentService,
  ConsentType,
} from '@csn/infra-gdpr';

class ConsentUpdateItemDto {
  @IsEnum(ConsentType)
  consentType!: ConsentType;

  @IsBoolean()
  granted!: boolean;

  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsString()
  userAgent?: string;
}

class UpdateConsentsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConsentUpdateItemDto)
  consents!: ConsentUpdateItemDto[];
}

@ApiTags('Privacy & GDPR')
@ApiBearerAuth()
@Controller('api/privacy')
export class PrivacyController {
  constructor(
    private readonly exportService: DataExportService,
    private readonly erasureService: DataErasureService,
    private readonly consentService: ConsentService,
  ) {}

  @Post('export-request')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Request a data export (GDPR Article 20)' })
  @ApiResponse({ status: 202, description: 'Export request created and queued' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async requestExport(@CurrentUser() user: AccessTokenPayload) {
    const request = await this.exportService.createExportRequest(user.userId);
    return {
      id: request.id,
      status: request.status,
      createdAt: request.createdAt,
      message: 'Your data export has been queued. Check back using the export ID.',
    };
  }

  @Get('export/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Download exported data by request ID' })
  @ApiResponse({ status: 200, description: 'Export data returned' })
  @ApiResponse({ status: 404, description: 'Export request not found' })
  async getExport(
    @Param('id') requestId: string,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    const request = await this.exportService.getExportRequest(requestId, user.userId);
    if (!request) {
      throw new NotFoundException('Export request not found');
    }

    return {
      id: request.id,
      status: request.status,
      createdAt: request.createdAt,
      completedAt: request.completedAt,
      data: request.data,
      error: request.error,
    };
  }

  @Post('delete-account')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Request account deletion (GDPR Article 17)' })
  @ApiResponse({ status: 202, description: 'Account deletion initiated' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async deleteAccount(@CurrentUser() user: AccessTokenPayload) {
    const result = await this.erasureService.eraseMemberData(user.userId);

    if (result.errors.length > 0) {
      throw new ForbiddenException({
        message: 'Account deletion partially completed',
        contextsProcessed: result.contextsProcessed,
        errors: result.errors,
      });
    }

    return {
      message: 'Your account and data have been erased.',
      erasedAt: result.erasedAt,
      contextsProcessed: result.contextsProcessed,
    };
  }

  @Get('consents')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current consent settings' })
  @ApiResponse({ status: 200, description: 'Current consents returned' })
  async getConsents(@CurrentUser() user: AccessTokenPayload) {
    const consents = await this.consentService.getConsents(user.userId);
    return { consents };
  }

  @Put('consents')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update consent settings' })
  @ApiResponse({ status: 200, description: 'Consents updated' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async updateConsents(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: UpdateConsentsDto,
  ) {
    const consents = await this.consentService.updateConsents(user.userId, dto.consents);
    return { consents };
  }
}
