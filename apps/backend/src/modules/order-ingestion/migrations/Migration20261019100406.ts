import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261019100406 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "shipment_tracking" drop constraint if exists "shipment_tracking_bc_shipment_id_unique";`);
    this.addSql(`alter table if exists "shipment_notice_state" drop constraint if exists "shipment_notice_state_state_key_unique";`);
    this.addSql(`alter table if exists "shipment_notice" drop constraint if exists "shipment_notice_bc_shipment_revision_unique";`);
    this.addSql(`alter table if exists "shipment_notice" drop constraint if exists "shipment_notice_sequence_unique";`);
    this.addSql(`create table if not exists "shipment_notice" ("id" text not null, "sequence" integer not null, "previous_sequence" integer null, "bc_shipment_id" text not null, "revision" integer not null, "status" text check ("status" in ('shipped', 'revised', 'cancelled')) not null, "content_hash" text not null, "company_id" text not null, "order_id" text not null, "external_order_number" text not null, "bc_order_number" text not null, "shipment_number" text not null, "shipment_date" text not null, "bc_last_modified_at" timestamptz not null, "payload" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "shipment_notice_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_shipment_notice_deleted_at" ON "shipment_notice" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_shipment_notice_sequence_unique" ON "shipment_notice" ("sequence") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_shipment_notice_bc_shipment_revision_unique" ON "shipment_notice" ("bc_shipment_id", "revision") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_shipment_notice_company_sequence" ON "shipment_notice" ("company_id", "sequence") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_shipment_notice_order_id" ON "shipment_notice" ("order_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "shipment_notice_state" ("id" text not null, "state_key" text not null, "last_sequence" integer not null default 0, "lead_cursor" timestamptz not null, "trail_cursor" timestamptz not null, "go_live_at" timestamptz not null, "bc_backoff_until" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "shipment_notice_state_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_shipment_notice_state_deleted_at" ON "shipment_notice_state" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_shipment_notice_state_state_key_unique" ON "shipment_notice_state" ("state_key") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "shipment_tracking" ("id" text not null, "bc_shipment_id" text not null, "shipment_number" text not null, "bc_order_number" text not null, "posting_date" text not null, "company_id" text not null, "order_id" text not null, "external_order_number" text not null, "latest_revision" integer not null default 0, "state" text check ("state" in ('open', 'closed')) not null default 'open', "close_reason" text check ("close_reason" in ('cancelled', 'window_ended', 'superseded', 'gave_up')) null, "next_check_at" timestamptz not null, "recheck_until" timestamptz not null, "final_check_done" boolean not null default false, "closed_at" timestamptz null, "reopened_at" timestamptz null, "reopened_by" text null, "attempts" integer not null default 0, "last_error" text null, "last_checked_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "shipment_tracking_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_shipment_tracking_deleted_at" ON "shipment_tracking" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_shipment_tracking_bc_shipment_id_unique" ON "shipment_tracking" ("bc_shipment_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_shipment_tracking_state_next_check_at" ON "shipment_tracking" ("state", "next_check_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "shipment_notice" cascade;`);

    this.addSql(`drop table if exists "shipment_notice_state" cascade;`);

    this.addSql(`drop table if exists "shipment_tracking" cascade;`);
  }

}
