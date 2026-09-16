import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260916091913 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "order_external_reference" ("id" text not null, "external_order_number" text not null, "company_id" text not null, "order_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "order_external_reference_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_order_external_reference_deleted_at" ON "order_external_reference" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "order_external_reference" cascade;`);
  }

}
