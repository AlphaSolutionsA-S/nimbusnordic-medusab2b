import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260715000000 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      'ALTER TABLE "company" ADD COLUMN IF NOT EXISTS "business_central_customer_number" text NULL;'
    );
  }

  async down(): Promise<void> {
    this.addSql(
      'ALTER TABLE "company" DROP COLUMN IF EXISTS "business_central_customer_number";'
    );
  }
}
