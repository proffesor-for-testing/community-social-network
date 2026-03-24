import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConsentEntity, ConsentType } from './consent.entity';

export interface ConsentRecord {
  consentType: ConsentType;
  granted: boolean;
  updatedAt: Date;
}

export interface UpdateConsentDto {
  consentType: ConsentType;
  granted: boolean;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Manages GDPR consent records for members.
 * Tracks consent for essential, analytics, and marketing purposes.
 */
@Injectable()
export class ConsentService {
  private readonly logger = new Logger(ConsentService.name);

  constructor(
    @InjectRepository(ConsentEntity)
    private readonly consentRepo: Repository<ConsentEntity>,
  ) {}

  /**
   * Gets all current consent records for a member.
   */
  async getConsents(memberId: string): Promise<ConsentRecord[]> {
    const entities = await this.consentRepo.find({
      where: { memberId },
      order: { consentType: 'ASC' },
    });

    // Build a complete set of consents, defaulting missing ones
    const consentMap = new Map<ConsentType, ConsentRecord>();

    // Set defaults
    for (const type of Object.values(ConsentType)) {
      consentMap.set(type, {
        consentType: type,
        granted: type === ConsentType.ESSENTIAL, // Essential is always granted
        updatedAt: new Date(),
      });
    }

    // Override with stored values
    for (const entity of entities) {
      consentMap.set(entity.consentType, {
        consentType: entity.consentType,
        granted: entity.granted,
        updatedAt: entity.updatedAt,
      });
    }

    return Array.from(consentMap.values());
  }

  /**
   * Updates consent records for a member.
   * Essential consent cannot be revoked.
   */
  async updateConsents(
    memberId: string,
    consents: UpdateConsentDto[],
  ): Promise<ConsentRecord[]> {
    for (const consent of consents) {
      // Essential consent cannot be revoked
      if (consent.consentType === ConsentType.ESSENTIAL && !consent.granted) {
        this.logger.warn(
          `Attempt to revoke essential consent for member ${memberId} - ignoring`,
        );
        continue;
      }

      const existing = await this.consentRepo.findOne({
        where: { memberId, consentType: consent.consentType },
      });

      if (existing) {
        existing.granted = consent.granted;
        existing.ipAddress = consent.ipAddress || null;
        existing.userAgent = consent.userAgent || null;
        await this.consentRepo.save(existing);
      } else {
        const entity = this.consentRepo.create({
          memberId,
          consentType: consent.consentType,
          granted: consent.granted,
          ipAddress: consent.ipAddress || null,
          userAgent: consent.userAgent || null,
        });
        await this.consentRepo.save(entity);
      }
    }

    this.logger.log(`Consents updated for member ${memberId}`);
    return this.getConsents(memberId);
  }
}
