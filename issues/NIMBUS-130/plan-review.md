# NIMBUS-130 implementation plan review

Cross-checked on 2026-10-19. This version supersedes the initial review.

Evidence labels distinguish a verified counterexample to the planned algorithm or checked local source from a suspected implementation/vendor risk. No Business Central, Azure, Jira, or other external system was contacted. Two small in-memory models reproduced the overlap stall and stale-snapshot race; these are design counterexamples, not tests of an implementation or live BC behavior.

## Findings, most severe first

### F1. Blocker — verified: serialized writes can still publish stale revisions

**Location:** `plan.md` §1, §3B steps 6–8, §3C; `02-shipment-notice-storage.md` store seam; `05-shipment-notice-decision.md` latest-revision input.

**Problem:** The counter lock orders database commits, but the store accepts a hash/status/payload computed from an earlier BC read without checking the revision against which that decision was made.

**Failure scenario:** Revision 1 says quantity 10. Worker A reads a partial undo and prepares a revision with quantity 5. Worker B reads a subsequent full undo and stores revision 2, cancelled, quantity 0. A then obtains the counter lock, finds that its hash differs from the latest hash, and stores revision 3 with quantity 5. The customer receives a cancellation followed by goods apparently becoming shipped again. Interleaved writers can also publish the same content again after an intervening change. Both transactions can be correctly serialized and uniquely numbered.

**Suggested fix:** Establish the expected stored revision before fetching BC, pass it to the store, and compare it under the counter lock. On a conflict, discard the observation and repeat the read/decision process against the current revision. Do not use BC header `lastModifiedDateTime` as the freshness test: the recorded evidence says undo does not change it. Add a controlled stale-worker case, including cancellation committed before an older positive snapshot.

**Evidence:** Checked the task seams and ran the planned hash-comparison algorithm in memory: quantity 0 was stored as revision 2, then quantity 5 as revision 3. This contradicts the claim that concurrent runs only add duplicate BC reads.

### F2. Blocker — verified: overlap plus the header cap can stop all forward progress

**Location:** `plan.md` §3B steps 3 and 9, §10 catch-up claim; `04-bc-shipment-reads.md` changed-since seam.

**Problem:** Each run starts at watermark minus 30 minutes, takes the oldest 1,000 headers, and advances only to the newest returned timestamp, so already-processed overlap rows can fill every subsequent run.

**Failure scenario:** Watermark is 12:00. There are 1,000 distinct header timestamps between 11:31 and 12:00 and another shipment at 12:01. The next run returns the first 1,000 rows and leaves the watermark at 12:00. Every later run repeats them; the 12:01 shipment is never reached. No equal timestamps are required. Rows belonging to non-API customers can fill this cap too.

**Suggested fix:** Separate progress through the forward scan from replay of the overlap. Fully page a fixed scan window, or persist a resumable continuation position that also handles timestamp ties, while retaining bounded overlap reconciliation. Do not call the window complete until its pages are consumed. Cover a backlog where the overlap alone fills the cap, tied timestamps, and BC continuation responses.

**Evidence:** An in-memory model using 1,000 distinct overlap timestamps plus one newer row repeated three runs with the same watermark and never returned the newer row.

### F3. Blocker — verified from current source and installed Medusa: mapping failure can erase an accepted BC outcome

**Location:** `03-capture-bc-line-map.md` seam, new step after `recordBcOrderOutcomeStep`; `plan.md` §3A and §4 task 03. Current code: `apps/backend/src/workflows/business-central-order/steps/record-bc-order-outcome.ts`, `submit-bc-order.ts`, and `utils/admin-bc-integration.ts`.

**Problem:** Adding a throwing step after outcome recording exposes the existing outcome step's compensation, which restores the pre-submission metadata even though the BC order creation cannot be undone by that workflow.

**Failure scenario:** The first submission creates BC order SO1, records its sent state/identity, then the new reference-map write fails. Workflow compensation restores the previous pending state with no BC identity. An ordinary retry passes the existing duplicate guard and creates SO2. The plan's reference step also has no durable recovery path for its missing mapping.

**Suggested fix:** Preserve the recorded external outcome across enrichment failures. Give reference/map persistence a retry/reconciliation path that cannot compensate away an accepted BC identity. Add a failure case at the new step: the BC identity remains recorded, and an ordinary retry does not submit another BC order.

**Evidence:** The existing outcome compensation writes `compensationData.previousState` back to order metadata; submission has no compensating BC delete; the guard calls `hasBusinessCentralOrder`. Installed `@medusajs/workflows-sdk` 2.21.2 `dist/utils/composer/create-step.js` registers compensation callbacks, and `@medusajs/orchestration` `dist/transaction/transaction-orchestrator.js` enters compensation and flags executed steps to revert.

### F4. Major — verified: the re-check workload is unbounded

**Location:** `plan.md` §3B steps 5–6, §4 task 06; `06-poll-workflow-and-job.md`; `scope.md` Non-functional bounded-BC-load requirement.

**Problem:** Every eligible shipment from 14 days is re-read every minute, while the 1,000-header cap limits only the changed-since scan.

**Failure scenario:** 10,000 eligible shipment notices require at least 500 full-shipment requests per run at 20 numbers per request, before changed-header work. The next tick arrives while the previous run is active; the five-minute lock TTL has no demonstrated worst-case duration behind it. Multiple instances further increase request volume until the cross-instance provider ships.

**Suggested fix:** Define bounded, fairly scheduled re-check batches, a persisted progress position, request timeouts, throttle/backoff behavior, and an achievable maximum detection delay. Record backlog age, run duration, failures and watermark lag, with an alert for stalled progress. Ensure the lock lease is valid for the bounded run or maintained safely.

### F5. Major — verified recovery gap: skipped new shipments can leave the discovery window permanently

**Location:** `plan.md` §2 decision 5, §3B steps 5 and 8–9, §6 Poll state; `06-poll-workflow-and-job.md`.

**Problem:** An item error is logged and skipped while the watermark advances, but no persistent retry work is created for a shipment that has never produced a notice.

**Failure scenario:** After downtime, a batch includes an unpairable shipment timestamped 10:00 and a valid header timestamped 11:00. The watermark advances to 11:00, so the next scan starts after 10:30 and immediately excludes the failed shipment. It is not a re-check candidate because no notice exists. Even if a BC line correction later makes it pairable, an unchanged header timestamp will not bring it back.

**Suggested fix:** Persist the failed shipment identity with bounded retry/backoff and an operator recovery action, or explicitly document permanent omission as the accepted behavior. Do not imply guaranteed retry from the existing scan alone.

**Qualification:** The product owner has accepted skipping unpairable shipments and moving on. The missing recovery mechanism remains a reliability gap, but my initial description as an unconditional blocker overstated that agreed behavior.

### F6. Major — verified recovery blind spot: downtime can hide an undo made inside the 14-day window

**Location:** `plan.md` §5 `recheck_until`, §6 expired state; `02-shipment-notice-storage.md` re-check predicate.

**Problem:** Eligibility is based only on whether the shipment is unexpired now, without recording whether the final part of its window was ever checked successfully.

**Failure scenario:** A notice is last checked on day 12. The service goes offline, BC undoes the shipment on day 13, and the service resumes on day 15. The notice is already expired and excluded. Because undo need not change the header timestamp, changed-since discovery does not recover the correction either.

**Suggested fix:** Define recovery semantics for missed re-checks. Persist due/final-check work until it has been completed after recovery, or explicitly accept this blind spot. A final read after expiry may also include corrections made after day 14, so that tradeoff needs a decision; the header timestamp cannot distinguish them.

### F7. Major — verified test-intent gap: the proposed cursor test cannot prove visibility ordering

**Location:** `02-shipment-notice-storage.md`, second module-integration test intent.

**Problem:** Asserting gap-free sequences only after both writers settle does not prove that a reader could never have observed N+1 before N committed.

**Failure scenario:** An incorrect implementation allocates N to a blocked transaction and N+1 to another transaction that commits first. A customer reads N+1 and saves its cursor. N commits later. A final assertion after both settle sees a complete, ordered set and passes, although the customer has permanently skipped N.

**Suggested fix:** Control the interleaving with two database transactions and an independent reader. Hold the lower writer before commit, let the higher writer attempt to proceed, and assert the reader cannot observe the higher sequence first. Then release the writer and verify paging includes both. Keep the same-content concurrency case separately.

### F8. Minor — suspected: line-order independence is not specified or tested

**Location:** `05-shipment-notice-decision.md`, netting and hash test intent; `04-bc-shipment-reads.md` expanded-line response.

**Problem:** The plan does not explicitly make correction pairing and hash generation independent of the order in which BC returns expanded lines.

**Failure scenario:** BC returns the same line set in a different array order. An implementation that hashes that order emits a false revision; an implementation that interprets “preceding” as array position can fail correction pairing.

**Suggested fix:** Define “preceding” by BC sequence, canonicalize hash input by stable line identity, and test permutations of the same line set.

**Correction to the first review:** JSON numeric forms such as `1.0` and `1.00` parse to the same JavaScript number. Different spelling alone is not evidence of a hash defect. No decimal-related failure has been established here.

## Corrections to the initial review

| Original finding | Cross-check result |
|---|---|
| 1: timestamp ties are skipped by the next `gt` query | Retracted as stated: the plan subtracts a 30-minute overlap. Replaced by F2's verified lack-of-progress case. Continuation handling and ties still need design coverage. |
| 2: unpairable shipment is immediately lost | Narrowed to F5: it can be retried while inside the overlap, but recovery is not guaranteed after it leaves. Skipping is an accepted decision, so the original blocker rating was too strong. |
| 3: POST response `sequence` is a blocker | It remains an explicitly unverified vendor assumption, not a demonstrated runtime bug. The plan already records a null fallback, human acceptance and a TestDK pre-go-live check. Reconcile that gate with the architecture's before-dispatch evidence rule; do not present the uncertainty as a newly discovered omission. |
| 4: unbounded re-check load | Retained and made concrete as F4. |
| 5: hash instability from ordering and decimal spelling | Retained only as the suspected ordering gap F8. Decimal-spelling claim withdrawn. |
| 6: broad framework evidence gap | Withdrawn as a separate major finding. The plan does record primitive contracts and evidence, and installed source supports the transaction/decorator and job mechanisms. F7 identifies a specific insufficient assertion instead. |
| 7: first-use counter-row race | Withdrawn as a demonstrated finding: `plan.md` §5 explicitly specifies insert-if-absent. Atomic initialization deserves implementation coverage, but its absence cannot be inferred as a bug from this plan alone. |

The counter-row design itself is sound for commit ordering if all allocation and inserts use the same transaction and hold that row lock until commit. It does not address the stale-observation problem in F1.

## Questions still needing a clear answer

- After force resend overwrites the current BC order number and line map, do already-recorded old-number shipments continue receiving revisions? If so, where does their original line mapping come from?
- How will BC header and expanded-line continuation links be followed while preserving the per-run budget?
- Does the new Azure response path intentionally keep drop-ship names/addresses in Logic App run history, and what retention/access policy applies? The stateful NIMBUS-146 template protects only the token-list request inputs; its deployment instructions explicitly leave other action data and the Medusa key visible. Existing key/path-token exposure was an accepted decision, not a new discovery, but `plan.md` §7's no-personal-data-in-logs controls cover only job/route logs.
- Should `Accept: application/xml` transform 401/400/404/error bodies too? Task 08 specifies a success-envelope mapping but no error-envelope mapping or combined XML/error test.

There are three blocker findings in this corrected review: stale revisions, a stalled discovery watermark, and compensation erasing an accepted BC outcome. They should be resolved in the plan before dispatch.
