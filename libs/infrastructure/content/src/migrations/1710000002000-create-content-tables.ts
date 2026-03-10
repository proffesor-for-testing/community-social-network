import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateContentTables1710000002000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create publications table
    await queryRunner.query(`
      CREATE TABLE "publications" (
        "id" uuid NOT NULL,
        "author_id" uuid NOT NULL,
        "content" text NOT NULL,
        "status" varchar(32) NOT NULL DEFAULT 'PUBLISHED',
        "visibility" varchar(32) NOT NULL DEFAULT 'PUBLIC',
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "version" int NOT NULL DEFAULT 0,
        CONSTRAINT "PK_publications" PRIMARY KEY ("id")
      )
    `);

    // Create index on author_id for findByAuthorId queries
    await queryRunner.query(`
      CREATE INDEX "IDX_publications_author_id" ON "publications" ("author_id")
    `);

    // Create index on status for filtering
    await queryRunner.query(`
      CREATE INDEX "IDX_publications_status" ON "publications" ("status")
    `);

    // Create index on created_at for ordering
    await queryRunner.query(`
      CREATE INDEX "IDX_publications_created_at" ON "publications" ("created_at")
    `);

    // Create publication_mentions table
    await queryRunner.query(`
      CREATE TABLE "publication_mentions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "publication_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "position" int NOT NULL,
        CONSTRAINT "PK_publication_mentions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_publication_mentions_publication"
          FOREIGN KEY ("publication_id")
          REFERENCES "publications" ("id")
          ON DELETE CASCADE
      )
    `);

    // Create index on publication_id for loading mentions with publications
    await queryRunner.query(`
      CREATE INDEX "IDX_publication_mentions_publication_id"
        ON "publication_mentions" ("publication_id")
    `);

    // Create publication_reactions table
    await queryRunner.query(`
      CREATE TABLE "publication_reactions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "publication_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "type" varchar(32) NOT NULL,
        CONSTRAINT "PK_publication_reactions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_publication_reactions_pub_user"
          UNIQUE ("publication_id", "user_id"),
        CONSTRAINT "FK_publication_reactions_publication"
          FOREIGN KEY ("publication_id")
          REFERENCES "publications" ("id")
          ON DELETE CASCADE
      )
    `);

    // Create index on publication_id for loading reactions with publications
    await queryRunner.query(`
      CREATE INDEX "IDX_publication_reactions_publication_id"
        ON "publication_reactions" ("publication_id")
    `);

    // Create discussions table
    await queryRunner.query(`
      CREATE TABLE "discussions" (
        "id" uuid NOT NULL,
        "publication_id" uuid NOT NULL,
        "author_id" uuid NOT NULL,
        "parent_id" uuid,
        "content" text NOT NULL,
        "status" varchar(32) NOT NULL DEFAULT 'ACTIVE',
        "created_at" timestamp NOT NULL DEFAULT now(),
        "version" int NOT NULL DEFAULT 0,
        CONSTRAINT "PK_discussions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_discussions_publication"
          FOREIGN KEY ("publication_id")
          REFERENCES "publications" ("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_discussions_parent"
          FOREIGN KEY ("parent_id")
          REFERENCES "discussions" ("id")
          ON DELETE SET NULL
      )
    `);

    // Create index on publication_id for findByPublicationId queries
    await queryRunner.query(`
      CREATE INDEX "IDX_discussions_publication_id"
        ON "discussions" ("publication_id")
    `);

    // Create index on parent_id for thread queries
    await queryRunner.query(`
      CREATE INDEX "IDX_discussions_parent_id"
        ON "discussions" ("parent_id")
    `);

    // Create index on author_id for user's discussions
    await queryRunner.query(`
      CREATE INDEX "IDX_discussions_author_id"
        ON "discussions" ("author_id")
    `);

    // Create index on created_at for ordering
    await queryRunner.query(`
      CREATE INDEX "IDX_discussions_created_at"
        ON "discussions" ("created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "discussions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "publication_reactions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "publication_mentions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "publications"`);
  }
}
