import {
  generateEntityId,
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaError,
  MedusaService,
} from "@medusajs/framework/utils";
import type { Context } from "@medusajs/framework/types";
import type { SqlEntityManager } from "@medusajs/framework/mikro-orm/knex";
import {
  OrderExternalReference,
  ShipmentNotice,
  ShipmentNoticeState,
  ShipmentTracking,
} from "./models";
import {
  SHIPMENT_NOTICE_STATE_KEY,
  type CompanyShipmentNoticeQuery,
  type ShipmentNoticeRow,
  type ShipmentPollCursor,
  type ShipmentPollState,
  type ShipmentTrackingClose,
  type ShipmentTrackingDiscovery,
  type ShipmentTrackingReschedule,
  type ShipmentTrackingRow,
  type ShipmentTrackingSchedule,
  type StoreShipmentNoticeInput,
  type StoreShipmentNoticeResult,
} from "./shipment-notice-storage";

const TRACKING_COLUMNS = `id, bc_shipment_id, shipment_number, bc_order_number, posting_date,
  company_id, order_id, external_order_number, latest_revision, state, close_reason,
  next_check_at, recheck_until, final_check_done, closed_at, reopened_at, reopened_by, attempts,
  last_error, last_checked_at, created_at, updated_at`;

const NOTICE_COLUMNS = `id, sequence, previous_sequence, bc_shipment_id, revision, status,
  content_hash, company_id, order_id, external_order_number, bc_order_number, shipment_number,
  shipment_date, bc_last_modified_at, payload, created_at`;

const POLL_STATE_COLUMNS = "last_sequence, lead_cursor, trail_cursor, go_live_at, bc_backoff_until";

const POLL_CURSOR_COLUMNS: Record<ShipmentPollCursor, string> = {
  lead: "lead_cursor",
  trail: "trail_cursor",
};

function transactionManagerOf(context: Context<SqlEntityManager>): SqlEntityManager {
  const manager = context.transactionManager;
  if (!manager) {
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Missing transaction manager");
  }
  return manager;
}

function pollStateMissing(): MedusaError {
  return new MedusaError(
    MedusaError.Types.NOT_FOUND,
    "Shipment notice poll state is not initialized"
  );
}

class OrderIngestionModuleService extends MedusaService({
  OrderExternalReference,
  ShipmentNotice,
  ShipmentTracking,
  ShipmentNoticeState,
}) {
  /**
   * Stores one shipment notice revision against the revision the caller decided on (NIMBUS-130).
   * The counter row lock is held to commit, so notices commit in cursor order and a reader paging
   * by cursor never sees N+1 before N. A newer revision stored meanwhile is a conflict.
   */
  @InjectManager()
  async storeShipmentNotice(
    input: StoreShipmentNoticeInput,
    @MedusaContext() context: Context<SqlEntityManager> = {}
  ): Promise<StoreShipmentNoticeResult> {
    return this.storeShipmentNotice_(input, context);
  }

  @InjectTransactionManager()
  protected async storeShipmentNotice_(
    input: StoreShipmentNoticeInput,
    @MedusaContext() context: Context<SqlEntityManager> = {}
  ): Promise<StoreShipmentNoticeResult> {
    if (!input.company_id || !input.order_id) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "A shipment notice needs the company and order of its API order"
      );
    }
    const manager = transactionManagerOf(context);

    const [counter] = await manager.execute<Array<{ last_sequence: number }>>(
      `SELECT last_sequence FROM shipment_notice_state
       WHERE state_key = ? AND deleted_at IS NULL
       FOR UPDATE`,
      [SHIPMENT_NOTICE_STATE_KEY]
    );
    if (!counter) {
      throw pollStateMissing();
    }

    const [latest] = await manager.execute<
      Array<{ revision: number; sequence: number; content_hash: string }>
    >(
      `SELECT revision, sequence, content_hash FROM shipment_notice
       WHERE bc_shipment_id = ? AND deleted_at IS NULL
       ORDER BY revision DESC LIMIT 1`,
      [input.bc_shipment_id]
    );
    const latestRevision = latest ? Number(latest.revision) : 0;
    if (latestRevision !== input.expected_revision) {
      return { outcome: "conflict", latest_revision: latestRevision };
    }
    if (latest && latest.content_hash === input.content_hash) {
      return { outcome: "unchanged", revision: latestRevision };
    }

    const sequence = Number(counter.last_sequence) + 1;
    const revision = latestRevision + 1;

    const tracked = await this.applyTrackingSchedule(manager, input.bc_shipment_id, input.tracking, {
      latestRevision: revision,
      onlyOpen: false,
    });
    if (!tracked) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Shipment ${input.shipment_number} has no tracking row`
      );
    }
    await manager.execute(
      `UPDATE shipment_notice_state SET last_sequence = ?, updated_at = now()
       WHERE state_key = ? AND deleted_at IS NULL`,
      [sequence, SHIPMENT_NOTICE_STATE_KEY]
    );
    await manager.execute(
      `INSERT INTO shipment_notice
         (id, sequence, previous_sequence, bc_shipment_id, revision, status, content_hash,
          company_id, order_id, external_order_number, bc_order_number, shipment_number,
          shipment_date, bc_last_modified_at, payload)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS jsonb))`,
      [
        generateEntityId(undefined, "shpn"),
        sequence,
        latest ? Number(latest.sequence) : null,
        input.bc_shipment_id,
        revision,
        input.status,
        input.content_hash,
        input.company_id,
        input.order_id,
        input.external_order_number,
        input.bc_order_number,
        input.shipment_number,
        input.shipment_date,
        input.bc_last_modified_at,
        JSON.stringify(input.payload),
      ]
    );
    return { outcome: "stored", sequence, revision };
  }

  /**
   * The store applies its schedule whatever the row's state; a check-run update (`onlyOpen`)
   * leaves a closed row alone. Returns false when no row was updated.
   */
  private async applyTrackingSchedule(
    manager: SqlEntityManager,
    bcShipmentId: string,
    schedule: ShipmentTrackingSchedule,
    options: { latestRevision: number | null; onlyOpen: boolean }
  ): Promise<boolean> {
    const closing = schedule.action === "close";
    const rows = await manager.execute<Array<{ id: string }>>(
      `UPDATE shipment_tracking SET
         latest_revision = COALESCE(?, latest_revision),
         next_check_at = COALESCE(?, next_check_at),
         state = CASE WHEN ? THEN 'closed' ELSE state END,
         close_reason = CASE WHEN ? THEN ? ELSE close_reason END,
         closed_at = CASE WHEN ? THEN now() ELSE closed_at END,
         attempts = ?, last_error = ?, last_checked_at = ?, final_check_done = ?,
         updated_at = now()
       WHERE bc_shipment_id = ? AND deleted_at IS NULL ${options.onlyOpen ? "AND state = 'open'" : ""}
       RETURNING id`,
      [
        options.latestRevision,
        closing ? null : schedule.next_check_at,
        closing,
        closing,
        closing ? schedule.close_reason : null,
        closing,
        schedule.attempts,
        schedule.last_error,
        schedule.last_checked_at,
        schedule.final_check_done,
        bcShipmentId,
      ]
    );
    return rows.length > 0;
  }

  /** Inserts newly discovered shipments; for an open row a due time only ever moves earlier. */
  @InjectManager()
  async upsertShipmentTracking(
    shipments: ShipmentTrackingDiscovery[],
    @MedusaContext() context: Context<SqlEntityManager> = {}
  ): Promise<{ inserted: number; updated: number }> {
    return this.upsertShipmentTracking_(shipments, context);
  }

  @InjectTransactionManager()
  protected async upsertShipmentTracking_(
    shipments: ShipmentTrackingDiscovery[],
    @MedusaContext() context: Context<SqlEntityManager> = {}
  ): Promise<{ inserted: number; updated: number }> {
    const manager = transactionManagerOf(context);
    let inserted = 0;
    let updated = 0;
    for (const shipment of shipments) {
      // `xmax = 0` is true only for a row this statement inserted.
      const rows = await manager.execute<Array<{ inserted: boolean }>>(
        `INSERT INTO shipment_tracking
           (id, bc_shipment_id, shipment_number, bc_order_number, posting_date, company_id,
            order_id, external_order_number, latest_revision, state, next_check_at,
            recheck_until, final_check_done, attempts)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'open', ?, ?, false, 0)
         ON CONFLICT (bc_shipment_id) WHERE deleted_at IS NULL DO UPDATE
           SET next_check_at = EXCLUDED.next_check_at, updated_at = now()
           WHERE shipment_tracking.state = 'open'
             AND EXCLUDED.next_check_at < shipment_tracking.next_check_at
         RETURNING (xmax = 0) AS inserted`,
        [
          generateEntityId(undefined, "shtr"),
          shipment.bc_shipment_id,
          shipment.shipment_number,
          shipment.bc_order_number,
          shipment.posting_date,
          shipment.company_id,
          shipment.order_id,
          shipment.external_order_number,
          shipment.next_check_at,
          shipment.recheck_until,
        ]
      );
      if (rows[0]?.inserted) {
        inserted += 1;
      } else if (rows[0]) {
        updated += 1;
      }
    }
    return { inserted, updated };
  }

  @InjectManager()
  async listDueShipmentTracking(
    query: { now: Date; limit: number },
    @MedusaContext() context: Context<SqlEntityManager> = {}
  ): Promise<ShipmentTrackingRow[]> {
    return this.listDueShipmentTracking_(query, context);
  }

  @InjectTransactionManager()
  protected async listDueShipmentTracking_(
    query: { now: Date; limit: number },
    @MedusaContext() context: Context<SqlEntityManager> = {}
  ): Promise<ShipmentTrackingRow[]> {
    return transactionManagerOf(context).execute<ShipmentTrackingRow[]>(
      `SELECT ${TRACKING_COLUMNS} FROM shipment_tracking
       WHERE state = 'open' AND next_check_at <= ? AND deleted_at IS NULL
       ORDER BY next_check_at ASC, id ASC
       LIMIT ?`,
      [query.now, query.limit]
    );
  }

  /** Returns false when the row is not open (nothing changed). */
  @InjectManager()
  async rescheduleShipmentTracking(
    bcShipmentId: string,
    schedule: ShipmentTrackingReschedule,
    @MedusaContext() context: Context<SqlEntityManager> = {}
  ): Promise<boolean> {
    return this.updateOpenTracking_(bcShipmentId, { action: "reschedule", ...schedule }, context);
  }

  /** Returns false when the row is not open (nothing changed). */
  @InjectManager()
  async closeShipmentTracking(
    bcShipmentId: string,
    close: ShipmentTrackingClose,
    @MedusaContext() context: Context<SqlEntityManager> = {}
  ): Promise<boolean> {
    return this.updateOpenTracking_(bcShipmentId, { action: "close", ...close }, context);
  }

  @InjectTransactionManager()
  protected async updateOpenTracking_(
    bcShipmentId: string,
    schedule: ShipmentTrackingSchedule,
    @MedusaContext() context: Context<SqlEntityManager> = {}
  ): Promise<boolean> {
    return this.applyTrackingSchedule(transactionManagerOf(context), bcShipmentId, schedule, {
      latestRevision: null,
      onlyOpen: true,
    });
  }

  @InjectManager()
  async listGaveUpShipmentTracking(
    page: { limit: number; offset: number },
    @MedusaContext() context: Context<SqlEntityManager> = {}
  ): Promise<{ rows: ShipmentTrackingRow[]; count: number }> {
    return this.listGaveUpShipmentTracking_(page, context);
  }

  @InjectTransactionManager()
  protected async listGaveUpShipmentTracking_(
    page: { limit: number; offset: number },
    @MedusaContext() context: Context<SqlEntityManager> = {}
  ): Promise<{ rows: ShipmentTrackingRow[]; count: number }> {
    const manager = transactionManagerOf(context);
    const where = "state = 'closed' AND close_reason = 'gave_up' AND deleted_at IS NULL";
    const rows = await manager.execute<ShipmentTrackingRow[]>(
      `SELECT ${TRACKING_COLUMNS} FROM shipment_tracking WHERE ${where}
       ORDER BY closed_at DESC, id DESC
       LIMIT ? OFFSET ?`,
      [page.limit, page.offset]
    );
    const [{ count }] = await manager.execute<Array<{ count: string | number }>>(
      `SELECT count(*) AS count FROM shipment_tracking WHERE ${where}`
    );
    return { rows, count: Number(count) };
  }

  /** Admin retry: only a row closed `gave_up` is reopened; any other state is refused. */
  @InjectManager()
  async reopenShipmentTracking(
    id: string,
    actorId: string,
    @MedusaContext() context: Context<SqlEntityManager> = {}
  ): Promise<ShipmentTrackingRow> {
    return this.reopenShipmentTracking_(id, actorId, context);
  }

  @InjectTransactionManager()
  protected async reopenShipmentTracking_(
    id: string,
    actorId: string,
    @MedusaContext() context: Context<SqlEntityManager> = {}
  ): Promise<ShipmentTrackingRow> {
    const manager = transactionManagerOf(context);
    const [reopened] = await manager.execute<ShipmentTrackingRow[]>(
      `UPDATE shipment_tracking SET
         state = 'open', close_reason = NULL, closed_at = NULL, attempts = 0,
         next_check_at = now(), reopened_at = now(), reopened_by = ?, updated_at = now()
       WHERE id = ? AND state = 'closed' AND close_reason = 'gave_up' AND deleted_at IS NULL
       RETURNING ${TRACKING_COLUMNS}`,
      [actorId, id]
    );
    if (reopened) {
      return reopened;
    }
    const [existing] = await manager.execute<Array<{ id: string }>>(
      "SELECT id FROM shipment_tracking WHERE id = ? AND deleted_at IS NULL",
      [id]
    );
    if (!existing) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Shipment tracking row was not found");
    }
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Only a shipment that gave up can be retried"
    );
  }

  /** Null before the poll job's first run. */
  @InjectManager()
  async retrieveShipmentPollState(
    @MedusaContext() context: Context<SqlEntityManager> = {}
  ): Promise<ShipmentPollState | null> {
    return this.retrieveShipmentPollState_(context);
  }

  @InjectTransactionManager()
  protected async retrieveShipmentPollState_(
    @MedusaContext() context: Context<SqlEntityManager> = {}
  ): Promise<ShipmentPollState | null> {
    const [row] = await transactionManagerOf(context).execute<ShipmentPollState[]>(
      `SELECT ${POLL_STATE_COLUMNS} FROM shipment_notice_state
       WHERE state_key = ? AND deleted_at IS NULL`,
      [SHIPMENT_NOTICE_STATE_KEY]
    );
    return row ? { ...row, last_sequence: Number(row.last_sequence) } : null;
  }

  /**
   * First run: sets go-live and both scan cursors to `now`. Concurrent first runs create one row;
   * `created` is true only for the run that created it.
   */
  @InjectManager()
  async initializeShipmentPollState(
    now: Date,
    @MedusaContext() context: Context<SqlEntityManager> = {}
  ): Promise<{ state: ShipmentPollState; created: boolean }> {
    return this.initializeShipmentPollState_(now, context);
  }

  @InjectTransactionManager()
  protected async initializeShipmentPollState_(
    now: Date,
    @MedusaContext() context: Context<SqlEntityManager> = {}
  ): Promise<{ state: ShipmentPollState; created: boolean }> {
    const manager = transactionManagerOf(context);
    const [created] = await manager.execute<ShipmentPollState[]>(
      `INSERT INTO shipment_notice_state
         (id, state_key, last_sequence, lead_cursor, trail_cursor, go_live_at)
       VALUES (?, ?, 0, ?, ?, ?)
       ON CONFLICT (state_key) WHERE deleted_at IS NULL DO NOTHING
       RETURNING ${POLL_STATE_COLUMNS}`,
      [generateEntityId(undefined, "shps"), SHIPMENT_NOTICE_STATE_KEY, now, now, now]
    );
    if (created) {
      return { state: { ...created, last_sequence: Number(created.last_sequence) }, created: true };
    }
    const existing = await this.retrieveShipmentPollState_(context);
    if (!existing) {
      throw pollStateMissing();
    }
    return { state: existing, created: false };
  }

  @InjectManager()
  async setShipmentPollCursor(
    cursor: ShipmentPollCursor,
    value: Date,
    @MedusaContext() context: Context<SqlEntityManager> = {}
  ): Promise<void> {
    return this.updatePollState_(POLL_CURSOR_COLUMNS[cursor], value, context);
  }

  /** `null` clears the back-off. */
  @InjectManager()
  async setShipmentPollBackoff(
    until: Date | null,
    @MedusaContext() context: Context<SqlEntityManager> = {}
  ): Promise<void> {
    return this.updatePollState_("bc_backoff_until", until, context);
  }

  @InjectTransactionManager()
  protected async updatePollState_(
    column: string,
    value: Date | null,
    @MedusaContext() context: Context<SqlEntityManager> = {}
  ): Promise<void> {
    // `column` comes only from the fixed names above, never from input.
    const rows = await transactionManagerOf(context).execute<Array<{ id: string }>>(
      `UPDATE shipment_notice_state SET ${column} = ?, updated_at = now()
       WHERE state_key = ? AND deleted_at IS NULL
       RETURNING id`,
      [value, SHIPMENT_NOTICE_STATE_KEY]
    );
    if (!rows.length) {
      throw pollStateMissing();
    }
  }

  /** One company's notices in cursor order; reads `limit + 1` rows so the caller can set `has_more`. */
  @InjectManager()
  async listCompanyShipmentNotices(
    query: CompanyShipmentNoticeQuery,
    @MedusaContext() context: Context<SqlEntityManager> = {}
  ): Promise<ShipmentNoticeRow[]> {
    return this.listCompanyShipmentNotices_(query, context);
  }

  @InjectTransactionManager()
  protected async listCompanyShipmentNotices_(
    query: CompanyShipmentNoticeQuery,
    @MedusaContext() context: Context<SqlEntityManager> = {}
  ): Promise<ShipmentNoticeRow[]> {
    const [bound, value] =
      "after" in query ? ["sequence > ?", query.after] : ["created_at >= ?", query.since];
    const rows = await transactionManagerOf(context).execute<ShipmentNoticeRow[]>(
      `SELECT ${NOTICE_COLUMNS} FROM shipment_notice
       WHERE company_id = ? AND ${bound} AND deleted_at IS NULL
       ORDER BY sequence ASC
       LIMIT ?`,
      [query.company_id, value, query.limit + 1]
    );
    return rows;
  }
}

export default OrderIngestionModuleService;
