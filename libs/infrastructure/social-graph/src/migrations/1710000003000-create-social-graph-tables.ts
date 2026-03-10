import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSocialGraphTables1710000003000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "connections" (
        "id" uuid NOT NULL,
        "follower_id" uuid NOT NULL,
        "followee_id" uuid NOT NULL,
        "status" varchar(50) NOT NULL DEFAULT 'PENDING',
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "version" int NOT NULL DEFAULT 1,
        CONSTRAINT "PK_connections" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_connections_follower_followee" UNIQUE ("follower_id", "followee_id")
      );

      CREATE INDEX "IDX_connections_follower_id" ON "connections" ("follower_id");
      CREATE INDEX "IDX_connections_followee_id" ON "connections" ("followee_id");
    `);

    await queryRunner.query(`
      CREATE TABLE "blocks" (
        "id" uuid NOT NULL,
        "blocker_id" uuid NOT NULL,
        "blocked_id" uuid NOT NULL,
        "reason" varchar(500),
        "created_at" timestamp NOT NULL DEFAULT now(),
        "version" int NOT NULL DEFAULT 1,
        CONSTRAINT "PK_blocks" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_blocks_blocker_blocked" UNIQUE ("blocker_id", "blocked_id")
      );

      CREATE INDEX "IDX_blocks_blocker_id" ON "blocks" ("blocker_id");
      CREATE INDEX "IDX_blocks_blocked_id" ON "blocks" ("blocked_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "blocks";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "connections";`);
  }
}
