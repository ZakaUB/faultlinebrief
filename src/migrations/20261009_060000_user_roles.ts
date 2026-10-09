import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Backfill existing users as administrators before setting the safer default for new accounts.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" varchar;
    UPDATE "users" SET "role" = 'admin' WHERE "role" IS NULL;
    ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'draft_publisher';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users" DROP COLUMN IF EXISTS "role";
  `)
}
