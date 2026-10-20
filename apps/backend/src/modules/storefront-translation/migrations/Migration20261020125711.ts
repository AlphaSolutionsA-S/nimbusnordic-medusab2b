import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261020125711 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "country_language_configuration" ("id" text not null, "assignments" jsonb not null, "version" integer not null default 1, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "country_language_configuration_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_country_language_configuration_deleted_at" ON "country_language_configuration" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "country_language_configuration" cascade;`);
  }

}
