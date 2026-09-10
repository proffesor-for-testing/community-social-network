import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPublicationGroupId1710000007000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Nullable: existing rows are personal posts and stay on the main feed.
    await queryRunner.query(`
      ALTER TABLE "publications" ADD COLUMN "group_id" uuid
    `);

    // Partial index: the main feed and Explore both filter group_id IS NULL,
    // while the group feed looks up a single group id.
    await queryRunner.query(`
      CREATE INDEX "IDX_publications_group_id" ON "publications" ("group_id")
    `);

    // Composite index backing the keyset pagination of every feed read
    // (ORDER BY created_at DESC, id DESC).
    await queryRunner.query(`
      CREATE INDEX "IDX_publications_created_at_id"
        ON "publications" ("created_at" DESC, "id" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_publications_created_at_id"`);
    await queryRunner.query(`DROP INDEX "IDX_publications_group_id"`);
    await queryRunner.query(`ALTER TABLE "publications" DROP COLUMN "group_id"`);
  }
}
