import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAdminTables1710000006000 implements MigrationInterface {
  name = 'CreateAdminTables1710000006000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "audit_entries" (
        "id" uuid NOT NULL,
        "actor_id" uuid NOT NULL,
        "action" character varying(255) NOT NULL,
        "resource" character varying(255) NOT NULL,
        "resource_id" character varying(255) NOT NULL,
        "details" jsonb NOT NULL DEFAULT '{}',
        "ip_address" character varying(45) NOT NULL,
        "timestamp" TIMESTAMP NOT NULL DEFAULT now(),
        "version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_audit_entries" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_audit_entries_actor_id"
        ON "audit_entries" ("actor_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_audit_entries_resource"
        ON "audit_entries" ("resource", "resource_id")
    `);

    // Prevent DELETE at the database level to enforce immutability
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_audit_entry_delete()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'Audit entries cannot be deleted';
      END;
      $$ LANGUAGE plpgsql
    `);

    await queryRunner.query(`
      CREATE TRIGGER trg_prevent_audit_entry_delete
        BEFORE DELETE ON "audit_entries"
        FOR EACH ROW
        EXECUTE FUNCTION prevent_audit_entry_delete()
    `);

    // Prevent UPDATE at the database level to enforce immutability
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_audit_entry_update()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'Audit entries cannot be updated';
      END;
      $$ LANGUAGE plpgsql
    `);

    await queryRunner.query(`
      CREATE TRIGGER trg_prevent_audit_entry_update
        BEFORE UPDATE ON "audit_entries"
        FOR EACH ROW
        EXECUTE FUNCTION prevent_audit_entry_update()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS "trg_prevent_audit_entry_update" ON "audit_entries"
    `);

    await queryRunner.query(`
      DROP FUNCTION IF EXISTS "prevent_audit_entry_update"
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS "trg_prevent_audit_entry_delete" ON "audit_entries"
    `);

    await queryRunner.query(`
      DROP FUNCTION IF EXISTS "prevent_audit_entry_delete"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_audit_entries_resource"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_audit_entries_actor_id"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "audit_entries"
    `);
  }
}
