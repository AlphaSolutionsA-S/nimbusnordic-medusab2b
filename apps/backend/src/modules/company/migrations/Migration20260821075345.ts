import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260821075345 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "company" add column if not exists "blocked" text check ("blocked" in ('not_blocked', 'Ship', 'Invoice', 'All')) not null default 'not_blocked', add column if not exists "credit_limit" numeric null, add column if not exists "vat_number" text null, add column if not exists "raw_credit_limit" jsonb null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "company" drop column if exists "blocked", drop column if exists "credit_limit", drop column if exists "vat_number", drop column if exists "raw_credit_limit";`);
  }

}
