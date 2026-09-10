import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableUnique,
  TableForeignKey,
} from 'typeorm';

export class CreateDirectMessageTables1710000008000
  implements MigrationInterface
{
  name = 'CreateDirectMessageTables1710000008000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'conversations',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
          },
          {
            name: 'participant_a',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'participant_b',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'now()',
            isNullable: false,
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

    // Participants are stored in canonical (ascending) order, so this single
    // constraint enforces one conversation per pair in either direction.
    await queryRunner.createUniqueConstraint(
      'conversations',
      new TableUnique({
        name: 'UQ_conversations_participants',
        columnNames: ['participant_a', 'participant_b'],
      }),
    );

    await queryRunner.createIndex(
      'conversations',
      new TableIndex({
        name: 'IDX_conversations_participant_a',
        columnNames: ['participant_a'],
      }),
    );

    await queryRunner.createIndex(
      'conversations',
      new TableIndex({
        name: 'IDX_conversations_participant_b',
        columnNames: ['participant_b'],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'direct_messages',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
          },
          {
            name: 'conversation_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'sender_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'content',
            type: 'text',
            isNullable: false,
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
            name: 'version',
            type: 'int',
            default: 1,
            isNullable: false,
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'direct_messages',
      new TableForeignKey({
        name: 'FK_direct_messages_conversation',
        columnNames: ['conversation_id'],
        referencedTableName: 'conversations',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'direct_messages',
      new TableIndex({
        name: 'IDX_direct_messages_conversation_created',
        columnNames: ['conversation_id', 'created_at'],
      }),
    );

    await queryRunner.createIndex(
      'direct_messages',
      new TableIndex({
        name: 'IDX_direct_messages_unread',
        columnNames: ['conversation_id', 'sender_id', 'read_at'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('direct_messages', true);
    await queryRunner.dropTable('conversations', true);
  }
}
