import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Adds the `is_admin` flag to `members`, making admin status a data-layer
 * fact on the Member aggregate instead of an `ADMIN_EMAILS` env allowlist.
 */
export class AddMemberIsAdmin1710000009000 implements MigrationInterface {
  name = 'AddMemberIsAdmin1710000009000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'members',
      new TableColumn({
        name: 'is_admin',
        type: 'boolean',
        default: false,
        isNullable: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('members', 'is_admin');
  }
}
