import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261027225750 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "company" add column if not exists "business_central_not_found_at" timestamptz null, add column if not exists "business_central_not_found_environment" text check ("business_central_not_found_environment" in ('DK', 'NO')) null, add column if not exists "business_central_not_found_customer_number" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "company" drop column if exists "business_central_not_found_at", drop column if exists "business_central_not_found_environment", drop column if exists "business_central_not_found_customer_number";`);
  }

}
