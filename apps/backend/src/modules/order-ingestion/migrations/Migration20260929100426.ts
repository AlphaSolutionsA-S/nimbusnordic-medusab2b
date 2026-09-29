import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260929100426 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "order_external_reference" drop constraint if exists "order_external_reference_company_external_order_unique";`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_order_external_reference_company_external_order_unique" ON "order_external_reference" ("company_id", "external_order_number") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_order_external_reference_company_external_order_unique";`);
  }

}
