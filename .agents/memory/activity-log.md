---
name: Unified activity log
description: Durable decision on how the activity audit trail is stored
---
The full Activity Log deliberately reuses the legacy `payment_audit_logs` table (never renamed) rather than migrating to a new `activity_logs` table.

**Why:** renaming/migrating risked losing existing payment audit data; one table lets legacy and new entries appear in a single searchable view.

**How to apply:** keep writing all audit entries to that table; always resolve and persist the affected entity's school on each entry (main-admin actions must not default to a null school or they vanish from school-filtered views), and never store passwords/credentials in before/after snapshots.
