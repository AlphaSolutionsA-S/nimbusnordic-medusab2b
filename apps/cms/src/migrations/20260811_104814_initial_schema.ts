import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'service');
  CREATE TYPE "public"."enum_portal_pages_blocks_callout_variant" AS ENUM('info', 'warning', 'success', 'error');
  CREATE TYPE "public"."enum_portal_pages_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__portal_pages_v_blocks_callout_variant" AS ENUM('info', 'warning', 'success', 'error');
  CREATE TYPE "public"."enum__portal_pages_v_version_status" AS ENUM('draft', 'published');
  CREATE TABLE IF NOT EXISTS "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"role" "enum_users_role" DEFAULT 'admin' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"enable_a_p_i_key" boolean,
  	"api_key" varchar,
  	"api_key_index" varchar,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE IF NOT EXISTS "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"caption" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE IF NOT EXISTS "portal_pages_blocks_rich_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"content" jsonb,
  	"block_name" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "portal_pages_blocks_image" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"caption" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "portal_pages_blocks_callout" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"content" jsonb,
  	"variant" "enum_portal_pages_blocks_callout_variant",
  	"block_name" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "portal_pages_blocks_cta" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"url" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "portal_pages_blocks_faq_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question" varchar,
  	"answer" jsonb
  );
  
  CREATE TABLE IF NOT EXISTS "portal_pages_blocks_faq" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "portal_pages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar,
  	"title" varchar,
  	"description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_portal_pages_status" DEFAULT 'draft'
  );
  
  CREATE TABLE IF NOT EXISTS "_portal_pages_v_blocks_rich_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"content" jsonb,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "_portal_pages_v_blocks_image" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"caption" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "_portal_pages_v_blocks_callout" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"content" jsonb,
  	"variant" "enum__portal_pages_v_blocks_callout_variant",
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "_portal_pages_v_blocks_cta" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"url" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "_portal_pages_v_blocks_faq_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"question" varchar,
  	"answer" jsonb,
  	"_uuid" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "_portal_pages_v_blocks_faq" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "_portal_pages_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_slug" varchar,
  	"version_title" varchar,
  	"version_description" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__portal_pages_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean,
  	"autosave" boolean
  );
  
  CREATE TABLE IF NOT EXISTS "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"media_id" integer,
  	"portal_pages_id" integer
  );
  
  CREATE TABLE IF NOT EXISTS "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE IF NOT EXISTS "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  DO $$ BEGIN
   ALTER TABLE "portal_pages_blocks_rich_text" ADD CONSTRAINT "portal_pages_blocks_rich_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."portal_pages"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "portal_pages_blocks_image" ADD CONSTRAINT "portal_pages_blocks_image_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "portal_pages_blocks_image" ADD CONSTRAINT "portal_pages_blocks_image_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."portal_pages"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "portal_pages_blocks_callout" ADD CONSTRAINT "portal_pages_blocks_callout_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."portal_pages"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "portal_pages_blocks_cta" ADD CONSTRAINT "portal_pages_blocks_cta_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."portal_pages"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "portal_pages_blocks_faq_items" ADD CONSTRAINT "portal_pages_blocks_faq_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."portal_pages_blocks_faq"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "portal_pages_blocks_faq" ADD CONSTRAINT "portal_pages_blocks_faq_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."portal_pages"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "_portal_pages_v_blocks_rich_text" ADD CONSTRAINT "_portal_pages_v_blocks_rich_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_portal_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "_portal_pages_v_blocks_image" ADD CONSTRAINT "_portal_pages_v_blocks_image_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "_portal_pages_v_blocks_image" ADD CONSTRAINT "_portal_pages_v_blocks_image_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_portal_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "_portal_pages_v_blocks_callout" ADD CONSTRAINT "_portal_pages_v_blocks_callout_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_portal_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "_portal_pages_v_blocks_cta" ADD CONSTRAINT "_portal_pages_v_blocks_cta_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_portal_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "_portal_pages_v_blocks_faq_items" ADD CONSTRAINT "_portal_pages_v_blocks_faq_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_portal_pages_v_blocks_faq"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "_portal_pages_v_blocks_faq" ADD CONSTRAINT "_portal_pages_v_blocks_faq_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_portal_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "_portal_pages_v" ADD CONSTRAINT "_portal_pages_v_parent_id_portal_pages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."portal_pages"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_portal_pages_fk" FOREIGN KEY ("portal_pages_id") REFERENCES "public"."portal_pages"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  CREATE INDEX IF NOT EXISTS "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX IF NOT EXISTS "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX IF NOT EXISTS "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX IF NOT EXISTS "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX IF NOT EXISTS "portal_pages_blocks_rich_text_order_idx" ON "portal_pages_blocks_rich_text" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "portal_pages_blocks_rich_text_parent_id_idx" ON "portal_pages_blocks_rich_text" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "portal_pages_blocks_rich_text_path_idx" ON "portal_pages_blocks_rich_text" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "portal_pages_blocks_image_order_idx" ON "portal_pages_blocks_image" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "portal_pages_blocks_image_parent_id_idx" ON "portal_pages_blocks_image" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "portal_pages_blocks_image_path_idx" ON "portal_pages_blocks_image" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "portal_pages_blocks_image_image_idx" ON "portal_pages_blocks_image" USING btree ("image_id");
  CREATE INDEX IF NOT EXISTS "portal_pages_blocks_callout_order_idx" ON "portal_pages_blocks_callout" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "portal_pages_blocks_callout_parent_id_idx" ON "portal_pages_blocks_callout" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "portal_pages_blocks_callout_path_idx" ON "portal_pages_blocks_callout" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "portal_pages_blocks_cta_order_idx" ON "portal_pages_blocks_cta" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "portal_pages_blocks_cta_parent_id_idx" ON "portal_pages_blocks_cta" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "portal_pages_blocks_cta_path_idx" ON "portal_pages_blocks_cta" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "portal_pages_blocks_faq_items_order_idx" ON "portal_pages_blocks_faq_items" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "portal_pages_blocks_faq_items_parent_id_idx" ON "portal_pages_blocks_faq_items" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "portal_pages_blocks_faq_order_idx" ON "portal_pages_blocks_faq" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "portal_pages_blocks_faq_parent_id_idx" ON "portal_pages_blocks_faq" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "portal_pages_blocks_faq_path_idx" ON "portal_pages_blocks_faq" USING btree ("_path");
  CREATE UNIQUE INDEX IF NOT EXISTS "portal_pages_slug_idx" ON "portal_pages" USING btree ("slug");
  CREATE INDEX IF NOT EXISTS "portal_pages_updated_at_idx" ON "portal_pages" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "portal_pages_created_at_idx" ON "portal_pages" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "portal_pages__status_idx" ON "portal_pages" USING btree ("_status");
  CREATE INDEX IF NOT EXISTS "_portal_pages_v_blocks_rich_text_order_idx" ON "_portal_pages_v_blocks_rich_text" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "_portal_pages_v_blocks_rich_text_parent_id_idx" ON "_portal_pages_v_blocks_rich_text" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "_portal_pages_v_blocks_rich_text_path_idx" ON "_portal_pages_v_blocks_rich_text" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "_portal_pages_v_blocks_image_order_idx" ON "_portal_pages_v_blocks_image" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "_portal_pages_v_blocks_image_parent_id_idx" ON "_portal_pages_v_blocks_image" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "_portal_pages_v_blocks_image_path_idx" ON "_portal_pages_v_blocks_image" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "_portal_pages_v_blocks_image_image_idx" ON "_portal_pages_v_blocks_image" USING btree ("image_id");
  CREATE INDEX IF NOT EXISTS "_portal_pages_v_blocks_callout_order_idx" ON "_portal_pages_v_blocks_callout" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "_portal_pages_v_blocks_callout_parent_id_idx" ON "_portal_pages_v_blocks_callout" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "_portal_pages_v_blocks_callout_path_idx" ON "_portal_pages_v_blocks_callout" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "_portal_pages_v_blocks_cta_order_idx" ON "_portal_pages_v_blocks_cta" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "_portal_pages_v_blocks_cta_parent_id_idx" ON "_portal_pages_v_blocks_cta" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "_portal_pages_v_blocks_cta_path_idx" ON "_portal_pages_v_blocks_cta" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "_portal_pages_v_blocks_faq_items_order_idx" ON "_portal_pages_v_blocks_faq_items" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "_portal_pages_v_blocks_faq_items_parent_id_idx" ON "_portal_pages_v_blocks_faq_items" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "_portal_pages_v_blocks_faq_order_idx" ON "_portal_pages_v_blocks_faq" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "_portal_pages_v_blocks_faq_parent_id_idx" ON "_portal_pages_v_blocks_faq" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "_portal_pages_v_blocks_faq_path_idx" ON "_portal_pages_v_blocks_faq" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "_portal_pages_v_parent_idx" ON "_portal_pages_v" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "_portal_pages_v_version_version_slug_idx" ON "_portal_pages_v" USING btree ("version_slug");
  CREATE INDEX IF NOT EXISTS "_portal_pages_v_version_version_updated_at_idx" ON "_portal_pages_v" USING btree ("version_updated_at");
  CREATE INDEX IF NOT EXISTS "_portal_pages_v_version_version_created_at_idx" ON "_portal_pages_v" USING btree ("version_created_at");
  CREATE INDEX IF NOT EXISTS "_portal_pages_v_version_version__status_idx" ON "_portal_pages_v" USING btree ("version__status");
  CREATE INDEX IF NOT EXISTS "_portal_pages_v_created_at_idx" ON "_portal_pages_v" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "_portal_pages_v_updated_at_idx" ON "_portal_pages_v" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "_portal_pages_v_latest_idx" ON "_portal_pages_v" USING btree ("latest");
  CREATE INDEX IF NOT EXISTS "_portal_pages_v_autosave_idx" ON "_portal_pages_v" USING btree ("autosave");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_portal_pages_id_idx" ON "payload_locked_documents_rels" USING btree ("portal_pages_id");
  CREATE INDEX IF NOT EXISTS "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX IF NOT EXISTS "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX IF NOT EXISTS "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX IF NOT EXISTS "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX IF NOT EXISTS "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "portal_pages_blocks_rich_text" CASCADE;
  DROP TABLE "portal_pages_blocks_image" CASCADE;
  DROP TABLE "portal_pages_blocks_callout" CASCADE;
  DROP TABLE "portal_pages_blocks_cta" CASCADE;
  DROP TABLE "portal_pages_blocks_faq_items" CASCADE;
  DROP TABLE "portal_pages_blocks_faq" CASCADE;
  DROP TABLE "portal_pages" CASCADE;
  DROP TABLE "_portal_pages_v_blocks_rich_text" CASCADE;
  DROP TABLE "_portal_pages_v_blocks_image" CASCADE;
  DROP TABLE "_portal_pages_v_blocks_callout" CASCADE;
  DROP TABLE "_portal_pages_v_blocks_cta" CASCADE;
  DROP TABLE "_portal_pages_v_blocks_faq_items" CASCADE;
  DROP TABLE "_portal_pages_v_blocks_faq" CASCADE;
  DROP TABLE "_portal_pages_v" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_portal_pages_blocks_callout_variant";
  DROP TYPE "public"."enum_portal_pages_status";
  DROP TYPE "public"."enum__portal_pages_v_blocks_callout_variant";
  DROP TYPE "public"."enum__portal_pages_v_version_status";`)
}
