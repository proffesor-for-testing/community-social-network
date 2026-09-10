import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { Email } from '@csn/domain-shared';
import type { IMemberRepository } from '@csn/domain-identity';
import { MEMBER_REPOSITORY_TOKEN } from '@csn/infra-identity';
import { bootstrapAdminEmails } from '../utils/admin-roles';

/**
 * One-time bootstrap of admin privileges from the `ADMIN_EMAILS` env var.
 *
 * Admin status lives on the Member aggregate (`isAdmin`). This service exists
 * only so a freshly seeded environment (e.g. the dev seed's admin@csn.local)
 * has a working admin without manual SQL. It is idempotent: members that are
 * already admins are left untouched and unsaved.
 */
@Injectable()
export class AdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(
    @Inject(MEMBER_REPOSITORY_TOKEN)
    private readonly memberRepository: IMemberRepository,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.promoteConfiguredAdmins();
  }

  /** Promotes every existing member listed in ADMIN_EMAILS. */
  async promoteConfiguredAdmins(): Promise<number> {
    const emails = bootstrapAdminEmails();
    if (emails.length === 0) {
      return 0;
    }

    let promoted = 0;

    for (const raw of emails) {
      try {
        const member = await this.memberRepository.findByEmail(
          Email.create(raw),
        );

        if (!member) {
          this.logger.warn(
            `ADMIN_EMAILS lists ${raw} but no such member exists; skipping.`,
          );
          continue;
        }

        if (member.isAdmin) {
          continue;
        }

        member.promoteToAdmin('bootstrap');
        await this.memberRepository.save(member);
        promoted++;
        this.logger.log(`Promoted ${raw} to admin from ADMIN_EMAILS bootstrap.`);
      } catch (error) {
        this.logger.error(
          `Failed to bootstrap admin for ${raw}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return promoted;
  }
}
