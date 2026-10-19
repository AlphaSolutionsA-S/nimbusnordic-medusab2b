# Finalization: classify broad HTTP authentication failures

Compare the failing companies HTTP suite in `.tmp/NIMBUS-130-20261019-resume/final-http.log`
against merge-base `1b6e33ab5de42272f71dbd6cd10cc4df8e1e5af7`.

The broad HTTP suite is still running against its database. Do not start another DB-backed
run, mutate production source, or change fixtures while it is active. Read-only base-source
comparison is allowed. Establish whether current failures stem from unchanged base fixtures
and authentication configuration or from this epic's wiring. Legacy appearance alone is not
baseline evidence. Record exact evidence and mark any uncertain failures unresolved.

Use the existing run scratchpad for investigation notes. Return touched files (if any), the
specific affected tests, baseline evidence or an actionable epic regression. Preserve unrelated
NIMBUS-179 work. The dispatcher handles commits and tracker changes.
