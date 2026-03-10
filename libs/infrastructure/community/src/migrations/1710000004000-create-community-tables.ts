import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCommunityTables1710000004000 implements MigrationInterface {
  name = 'CreateCommunityTables1710000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "groups" (
        "id" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" text NOT NULL DEFAULT '',
        "owner_id" uuid NOT NULL,
        "is_public" boolean NOT NULL DEFAULT true,
        "require_approval" boolean NOT NULL DEFAULT false,
        "allow_member_posts" boolean NOT NULL DEFAULT true,
        "rules" jsonb NOT NULL DEFAULT '[]',
        "status" varchar(50) NOT NULL DEFAULT 'ACTIVE',
        "member_count" integer NOT NULL DEFAULT 0,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_groups" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_groups_name" ON "groups" ("name")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_groups_owner_id" ON "groups" ("owner_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_groups_status" ON "groups" ("status")
    `);

    await queryRunner.query(`
      CREATE TABLE "memberships" (
        "id" uuid NOT NULL,
        "group_id" uuid NOT NULL,
        "member_id" uuid NOT NULL,
        "role" varchar(50) NOT NULL,
        "joined_at" timestamp NOT NULL DEFAULT now(),
        "left_at" timestamp,
        "kicked_at" timestamp,
        "kicked_by" uuid,
        "version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_memberships" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_memberships_group_member" UNIQUE ("group_id", "member_id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_memberships_group_id" ON "memberships" ("group_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_memberships_member_id" ON "memberships" ("member_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "memberships"
      ADD CONSTRAINT "FK_memberships_group_id"
      FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "memberships" DROP CONSTRAINT "FK_memberships_group_id"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_memberships_member_id"`);
    await queryRunner.query(`DROP INDEX "IDX_memberships_group_id"`);
    await queryRunner.query(`DROP TABLE "memberships"`);
    await queryRunner.query(`DROP INDEX "IDX_groups_status"`);
    await queryRunner.query(`DROP INDEX "IDX_groups_owner_id"`);
    await queryRunner.query(`DROP INDEX "IDX_groups_name"`);
    await queryRunner.query(`DROP TABLE "groups"`);
  }
}
