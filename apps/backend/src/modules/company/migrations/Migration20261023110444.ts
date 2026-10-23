import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261023110444 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "company" add column if not exists "order_api_enabled" boolean not null default false;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "company" drop column if exists "order_api_enabled";`);
  }

}
