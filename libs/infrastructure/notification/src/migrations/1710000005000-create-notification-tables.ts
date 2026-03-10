import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateNotificationTables1710000005000
  implements MigrationInterface
{
  name = 'CreateNotificationTables1710000005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'alerts',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
          },
          {
            name: 'recipient_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'type',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'title',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'body',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'action_url',
            type: 'varchar',
            length: '2048',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'UNREAD'",
            isNullable: false,
          },
          {
            name: 'reference_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
            isNullable: false,
          },
          {
            name: 'read_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'dismissed_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'version',
            type: 'int',
            default: 1,
            isNullable: false,
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'alerts',
      new TableIndex({
        name: 'IDX_alerts_recipient_status',
        columnNames: ['recipient_id', 'status'],
      }),
    );

    await queryRunner.createIndex(
      'alerts',
      new TableIndex({
        name: 'IDX_alerts_recipient_created',
        columnNames: ['recipient_id', 'created_at'],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'notification_preferences',
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
            isNullable: false,
          },
          {
            name: 'channel_preferences',
            type: 'jsonb',
            default: "'{}'",
            isNullable: false,
          },
          {
            name: 'muted_until',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'version',
            type: 'int',
            default: 1,
            isNullable: false,
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'notification_preferences',
      new TableIndex({
        name: 'IDX_notification_preferences_member_id',
        columnNames: ['member_id'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('notification_preferences', true);
    await queryRunner.dropTable('alerts', true);
  }
}
