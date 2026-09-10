import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260821114023 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "company" add column if not exists "business_central_synced_at" timestamptz null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "company" drop column if exists "business_central_synced_at";`);
  }

}
