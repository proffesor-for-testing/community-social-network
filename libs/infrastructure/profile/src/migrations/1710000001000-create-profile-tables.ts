import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateProfileTables1710000001000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'profiles',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
          },
          {
            name: 'member_id',
            type: 'uuid',
            isUnique: true,
          },
          {
            name: 'display_name',
            type: 'varchar',
          },
          {
            name: 'bio',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'avatar_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'location',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'visibility',
            type: 'varchar',
            default: "'public'",
          },
          {
            name: 'show_email',
            type: 'boolean',
            default: false,
          },
          {
            name: 'show_location',
            type: 'boolean',
            default: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'version',
            type: 'int',
            default: 1,
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'profiles',
      new TableIndex({
        name: 'IDX_profiles_member_id',
        columnNames: ['member_id'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('profiles', 'IDX_profiles_member_id');
    await queryRunner.dropTable('profiles');
  }
}
