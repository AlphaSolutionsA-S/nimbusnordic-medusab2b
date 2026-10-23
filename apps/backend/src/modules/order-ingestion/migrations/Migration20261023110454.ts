import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261023110454 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "shipment_tracking" drop constraint if exists "shipment_tracking_close_reason_check";`);

    this.addSql(`alter table if exists "shipment_tracking" add constraint "shipment_tracking_close_reason_check" check("close_reason" in ('cancelled', 'window_ended', 'superseded', 'gave_up', 'company_not_enabled'));`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "shipment_tracking" drop constraint if exists "shipment_tracking_close_reason_check";`);

    this.addSql(`alter table if exists "shipment_tracking" add constraint "shipment_tracking_close_reason_check" check("close_reason" in ('cancelled', 'window_ended', 'superseded', 'gave_up'));`);
  }

}
