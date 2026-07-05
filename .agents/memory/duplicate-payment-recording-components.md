---
name: Duplicate PaymentRecording component names
description: payment-recording.tsx and payment-reconciliation.tsx both export a function named PaymentRecording, causing an import collision / broken build if both are imported normally.
---

`client/src/components/payment-recording.tsx` and `client/src/components/payment-reconciliation.tsx` both export a function literally named `PaymentRecording` (the reconciliation file was never renamed after a refactor). `admin-dashboard.tsx` imports the reconciliation one aliased as `PaymentReconciliation`, and the recording one as `PaymentRecording` — used in two different places (payment recording UI vs. bank statement reconciliation UI). The reconciliation one also requires a `userRole: "admin" | "sub-admin" | "bursar"` prop.

**Why:** A prior edit changed the reconciliation file's export name without updating the import alias in `admin-dashboard.tsx`, which broke the whole app at runtime (Vite overlay: "does not provide an export named 'PaymentReconciliation'") — this blocks every page, not just the payments tab.

**How to apply:** If either payment component fails to import, check both files for the actual export name before assuming one is missing; alias the import (`import { PaymentRecording as X }`) rather than renaming the export, since the export name is shared between two files with different purposes and props.
