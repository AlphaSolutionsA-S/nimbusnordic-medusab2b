import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260813143800 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      'ALTER TABLE "company" ALTER COLUMN "business_central_customer_number" TYPE text USING "business_central_customer_number"::text;'
    );
  }

  async down(): Promise<void> {
    this.addSql(
      'ALTER TABLE "company" ALTER COLUMN "business_central_customer_number" TYPE integer USING NULLIF("business_central_customer_number", \'\')::integer;'
    );
  }
}
