# NIMBUS-162 — Progress

## 2026-10-24 — Scope drafted
- **Owner:** scoper, on Klaus Petersen's go-ahead to scope.
- **Outcome:** Wrote `scope.md` (Story). Recorded Klaus's decisions: exactly two emails (password reset, employee invitation); language = effective language of the triggering storefront country (`country_language_configuration`, unassigned → English); no per-person language; invitation is a plain notification without credentials; delivery on Medusa Cloud already in place and unchanged (no `medusa-config.ts` change, no sender-domain step, no delivery issue). Proposed: email texts as translation keys edited in the Admin editor, per-text English fallback, built-in English last resort, escaping of admin text, no personal data in logs; 162 goes first and the invite-email issue builds its email translated on 162's mechanism.
- **Code facts checked:** reset request already carries `metadata.country_code` (used only for the link, default `dk`); the store employee-creation request (strict schema) carries no country; the Admin employee route runs the same employee-account workflow; `company.country` is nullable text, format unverified.
- **Tracker:** Jira NIMBUS-162 is in status Scoping, unassigned. Added scope-draft comment 255268 (decisions, proposed rules, open questions); description not changed. No transition: "Scope approved" waits for Klaus's approval of the scope. Invite-email issue not yet created (triage owns it); link it to NIMBUS-162 (Relates) and refer to it by key once it exists.
- **Open questions:** Admin-created employees get the invitation? (decides the company-country fallback); built-in English last resort; reset link default country; company country format; who translates and English fallback at go-live; missing email texts in the Admin missing-translations report.
- **Recommended route:** full pipeline (new business-rule home for email language, personal data in emails, password-reset email is auth-adjacent, translation contract shared with the invite-email issue); expected size about three tasks, backend only.
- **Next owner:** Klaus Petersen: answer the open questions and approve the scope. Then the scoper records "Scope approved" in Jira (comment + transition). Implementation planning needs a separate instruction.
- **Handover prompt:** "Read issues/NIMBUS-162/scope.md and PROGRESS.md. Apply Klaus's answers to the open questions by editing the scope in place, then record Scope approved on NIMBUS-162 (comment, fetch transitions, move to the ready state). Do not start implementation planning without a separate go-ahead."
- **Verification:** Source, documentation (Medusa docs MCP) and Jira reads only. Nothing built, sent or tested. Case folder uncommitted.

## 2026-10-24 — Open questions answered
- **Owner:** scoper, applying Klaus Petersen's answers (relayed by the coordinator).
- **Outcome:** Edited `scope.md` in place. New or changed rules: R4 (reset without country: English + `dk` link, decided); R6 (no storefront country: company country → its language → English, decided); R7 (Admin-created employees get the invitation; trigger in the shared employee-account workflow, NIMBUS-242); R9 (built-in English default, registered in `decisions.md` as an approved fallback copy); R10 (every fallback reported to the Admin missing-translations report through the existing `reportMissingTranslationsWorkflow`, email name as source instead of a page path, no personal data, never blocks the email); R12 (delivery team ships English + drafts for all eight languages, Nimbus reviews in Admin, English fallback acceptable at go-live; proposed, stands unless Klaus objects). Invite issue referred to as NIMBUS-242; the `customer_id` side note replaced by NIMBUS-243. `company.country` format is now a planner verification item (UNVERIFIED), not a business question.
- **Code facts checked:** missing keys are reported today by the storefront to `POST /internal/ui-translations/missing-keys` → `reportMissingTranslationsWorkflow` → `reportMissing`, which records only while the language exists and the key is absent or empty, skips dismissed rows and caps rows per language and globally.
- **Size:** about four tasks (was three), backend only: email-language rule; translated rendering with fallback, escaping and reporting; reset email on the mechanism plus import files; verification and docs.
- **Tracker:** comment 255274 on NIMBUS-162 recording the answers. No transition; "Scope approved" waits for Klaus's approval of the whole scope.
- **Next owner:** Klaus Petersen: approve the scope (and object to R12 if he disagrees). Then the scoper records Scope approved.
- **Handover prompt:** "Read issues/NIMBUS-162/scope.md and PROGRESS.md. On Klaus's approval, record Scope approved on NIMBUS-162 (comment, fetch transitions, move to the ready state). Do not start implementation planning without a separate go-ahead."
- **Verification:** Source and Jira reads only. Nothing built, sent or tested. Case folder uncommitted.

## 2026-10-24 — Scope approved
- **Owner:** scoper, on Klaus Petersen's approval ("All approved", relayed by the coordinator), including R12.
- **Outcome:** `scope.md` status set to approved; R12 marked approved. No other scope change.
- **Tracker:** Scope-approved comment 255276 (business rules, key decisions, no open business questions). Fetched transitions and applied `Scope approved` (611); Jira returned status **Estimation**. Assignee still unassigned; description unchanged.
- **Commit:** case folder committed locally on `develop` (`NIMBUS-162: Record approved scope for translated emails`); not pushed.
- **Next owner:** implementation-planner, started by the coordinator on Klaus's planning go-ahead.
- **Handover prompt:** "Plan NIMBUS-162 from issues/NIMBUS-162/scope.md (approved). Verify `company.country` against real data (UNVERIFIED), the missing-text report's page-path field for an email source label, and whether the resolved language is kept in the Notification record. NIMBUS-242 consumes the mechanism; keep its trigger and request contract out of this plan."
- **Verification:** Jira readback of the transition returned Estimation. No code built, sent or tested.

## 2026-10-24 — Plan drafted (with NIMBUS-242)
- **Owner:** implementation-planner, on Klaus Petersen's planning go-ahead; Klaus decided to plan NIMBUS-242 in the same plan (overrides the scope's note that 242's trigger and request contract stay out).
- **Outcome:** Wrote `plan.md`, `manifest.md` and six task files: 01 email-language rule, 02 email text rule and escaping, 03 reset email on the mechanism (NIMBUS-162); 04 invitation trigger and store request country, 05 invitation email, 06 storefront invite card sends the country (NIMBUS-242). One branch `feature/NIMBUS-162`. `Ready for Dispatch: false`.
- **Verification items:** report source label in `last_page_path` verified from source (service accepts any string ≤ 512; leading `/` only on the internal HTTP route; Admin shows it as text). Language kept as `notification.data.locale`; Medusa stores `data` but not `content` (verified, notification model 2.21.2). `company.country` real-data format UNVERIFIED (no database access); design fails safe to English, listed under "Needs your decision".
- **Tracker:** Sub-tasks created (component Customer Portal) at Klaus's request before plan approval: NIMBUS-244, -245, -246 under NIMBUS-162; NIMBUS-247, -248, -249 under NIMBUS-242. Comments 255277 (162) and 255278 (242). The "plan approved" comment waits for approval.
- **Next owner:** Klaus Petersen: answer plan section 2 and approve the plan (competing-model review recommended: personal data, auth-adjacent reset email). Then the planner sets Ready for Dispatch and records plan approved. Dispatch needs a separate go-ahead.
- **Handover prompt:** "Read issues/NIMBUS-162/PROGRESS.md and plan.md. Apply Klaus's answers to section 2, set Ready for Dispatch: true in manifest.md, and record plan approved on NIMBUS-162 and NIMBUS-242. Do not dispatch without a separate go-ahead."
- **Verification:** Source, installed-package and Jira reads; Jira writes as listed. No code built, sent or tested.

## 2026-10-24 — Plan approved
- **Owner:** implementation-planner, on Klaus Petersen's approval ("All ok", relayed by the coordinator).
- **Outcome:** All four section-2 defaults accepted and recorded as answers in `plan.md`: dispatch now, with `company.country` read from production as a release check; stricter R4 (country outside every region → English and `dk` link); greeting without a name; unknown placeholders or ICU syntax fall back without a report. `manifest.md` set to `Ready for Dispatch: true`.
- **Tracker:** Plan-approved comments 255279 (NIMBUS-162) and 255280 (NIMBUS-242). No transition: the procedure has none for plan approval; the dispatcher moves the issues to in progress when implementation starts. Sub-tasks NIMBUS-244 to NIMBUS-249 already exist.
- **Next owner:** task-dispatcher, started by the coordinator (Klaus said "dispatch").
- **Handover prompt:** "Run the plan in issues/NIMBUS-162/ (manifest.md, Ready for Dispatch: true) on branch feature/NIMBUS-162 from develop. Tasks 01–03 belong to NIMBUS-162 (NIMBUS-244/245/246), tasks 04–06 to NIMBUS-242 (NIMBUS-247/248/249); use each task's Issue column. Read plan.md section 2 answers first. Do not touch the customer_id branches (NIMBUS-243). Nothing is pushed without the human's go-ahead."
- **Verification:** Jira writes returned comment ids. No code built, sent or tested.

## 2026-10-25 — Implemented, waiting at the pre-push gate
- **Owner:** task-dispatcher, on Klaus Petersen's dispatch go-ahead (2026-10-24).
- **Outcome:** Branch `feature/NIMBUS-162` (from `develop` 13e861e), local only. Tasks 01–06 done and reviewed: c358dc3 (NIMBUS-244), 681e039 (NIMBUS-245), 1c2485d (NIMBUS-246), c5e5ce6 (NIMBUS-247), 5558180 (NIMBUS-248), 4659830 (NIMBUS-249); spec fix 9a2b835 (NIMBUS-248); consolidation 3c9509d. Integration review approved; `deviation-report.md` written with five open questions.
- **Verification:** backend unit 1030/1030, admin 71/71, lint 0 errors, typecheck 22 (baseline 22), build OK; the two new/changed HTTP specs 35/35 against a throwaway Postgres; full HTTP suite failures (quotes, 3 security-boundaries cases) also fail on `develop`. Storefront tests 3 failing (baseline 3), typecheck 58 (baseline 58); storefront lint and build not run (installed next 16.4.2 vs pinned 15.5). `pnpm ai:check` red (AGENTS.md 33103 > 32768 bytes). Nothing deployed or sent.
- **Tracker:** sub-tasks NIMBUS-244 to 249 Done with closing comments. NIMBUS-162 (Estimation) and NIMBUS-242 not moved: no direct transition to In Progress (comments 255281, 255282).
- **Next owner:** Klaus Petersen: answer the open questions in `deviation-report.md`. Then the dispatcher resumes "After the gate" (fixes, docs, PR description, cleanup). Push only on Klaus's explicit instruction.
- **Handover prompt:** "Resume the task-dispatcher for issues/NIMBUS-162 at 'After the gate' with Klaus's answers to deviation-report.md's open questions. Merge-base 13e861e. Do not push."
