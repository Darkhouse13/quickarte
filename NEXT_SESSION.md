# Next session — finish the QuickArte ↔ Mizane rewire

Read first: `MIZANE_QUICKARTE_FINALIZATION.md`, `STRIP_CUSTOMER_ONLY.md`, and
`QUICKARTE_SANDBOX_HANDOFF.md`.

The strip-down to customer-only is **done and the app builds** (branch
`client-1/m1-strip-customer-only`). Now do the "rewire" work, **smallest-risk first**:

1. **Live-verify the re-homed Mizane poll** against the sandbox: place an order, have it
   confirmed/rejected staff-side, and watch `/api/orders/[token]/status` reconcile.
2. **Menu sync completeness:** add ETag/304 conditional fetch + soft-delete of entities
   removed from Mizane.
3. **Status UX:** surface Mizane's authoritative total + clean `rejected`/`expired` handling
   on the customer tracker.
4. **Per-table QR:** generate per-table QR deep-linking Mizane's `tableId` (consume `GET /tables`).

Keep it simple — no over-engineering. Verify with `npm run typecheck`, `npm test`, and
`npx next build` after each change.

(Scripts need `MIZANE_INTEGRATION_KEY` in `.env`. The handoff docs are gitignored but present
on disk locally.)
