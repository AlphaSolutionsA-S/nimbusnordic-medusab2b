import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260930183236 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "translation_missing_key" drop constraint if exists "translation_missing_key_locale_key_unique";`);
    this.addSql(`alter table if exists "storefront_translation" drop constraint if exists "storefront_translation_locale_unique";`);
    this.addSql(`create table if not exists "storefront_translation" ("id" text not null, "locale" text not null, "messages" jsonb not null, "version" integer not null default 1, "is_active" boolean not null default false, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "storefront_translation_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_storefront_translation_deleted_at" ON "storefront_translation" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_storefront_translation_locale_unique" ON "storefront_translation" ("locale") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "translation_missing_key" ("id" text not null, "locale" text not null, "key" text not null, "count" integer not null default 1, "first_seen_at" timestamptz not null, "last_seen_at" timestamptz not null, "last_page_path" text not null, "dismissed" boolean not null default false, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "translation_missing_key_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_translation_missing_key_deleted_at" ON "translation_missing_key" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_translation_missing_key_locale_key_unique" ON "translation_missing_key" ("locale", "key") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_translation_missing_key_locale_dismissed_seen" ON "translation_missing_key" ("locale", "dismissed", "last_seen_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "storefront_translation" cascade;`);

    this.addSql(`drop table if exists "translation_missing_key" cascade;`);
  }

}
