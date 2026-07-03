---
name: Drizzle phantom select column
description: Why a Drizzle .select() crashes with "Cannot convert undefined or null to object" and how to diagnose it fast.
---

A Drizzle `db.select({ ... })` that references a column property which does NOT exist on
the pgTable object (e.g. `fileSize: bankStatements.fileSize` when the table has no
`fileSize` column) evaluates that property to `undefined`. Drizzle then throws at query
build time:

```
TypeError: Cannot convert undefined or null to object
    at Function.entries (<anonymous>)
    at orderSelectedFields (drizzle .../utils.ts)
```

**Why it's confusing:** the error names NO column and points into drizzle internals, not
your code. The whole endpoint returns 500, and a frontend `useQuery` with a default of
`[]` will silently render an empty/"nothing here" state — looking like an empty database
rather than a crash.

**How to diagnose:** when a list "shows nothing", check the SERVER logs for a 500 on that
endpoint first — do not assume the table is empty. Then diff every key in the failing
`.select({})` against the actual `pgTable` definition in `shared/schema.ts`; the offending
key is the one with no matching column.

**How to apply:** keep `.select({})` field lists in lockstep with the table schema. If a
column is removed from (or never added to) the schema, remove its reference from every
`.select({})` too.
