# Jira: Nimbus Nordic project rules

These add to `SKILL.md` and win where the two differ.

## Component `Customer Portal`

Every NIMBUS issue carries the component `Customer Portal`, including the sub-tasks the
`implementation-planner` creates per plan task.

- **Create:** add `"components": [{ "name": "Customer Portal" }]` to every create payload (issue,
  bug, sub-task, child task).
- **Start work:** when fetching an issue, also read `components`. If `Customer Portal` is missing,
  add it and say so: "Added component `Customer Portal` to NIMBUS-xxx." Never remove other components.
- **Search:** scope every JQL search to the component:
  `project = NIMBUS AND component = "Customer Portal" AND text ~ "<keywords>" ORDER BY updated DESC`.
  Issues outside the component belong to other teams; don't pick them up.

## Links

Repo files cited in Jira use the full URL
`https://github.com/AlphaSolutionsA-S/nimbusnordic-medusab2b/blob/develop/<path>`, never a bare path.
