# Aggregate statistics backend

Maintenance-only; excluded from the public Pages artifact.

Use the existing Cloudflare Workers Free account and official Wrangler 4.149.0.
No website hosting/DNS migration. Keep credentials outside the repository.

1. `wrangler d1 create kew-riverside-statistics --location=weur`
2. Add its database ID to wrangler.jsonc in a D1 binding named COUNTS.
3. `wrangler d1 execute kew-riverside-statistics --remote --file=schema.sql`
4. `wrangler deploy`
5. Verify observability disabled, daily retention cron and schema via the authenticated dashboard.

The location hint does not establish EU-only processing. No paid upgrades or request-body logs.

Private daily page views, in D1 Console:

```sql
SELECT day, label AS page, total AS views
FROM counts WHERE metric = 'page' ORDER BY day DESC, total DESC;
```

Interactions separately, without joining dimensions into profiles:

```sql
SELECT day, metric, label, total FROM counts
WHERE metric <> 'page' ORDER BY day DESC, metric, total DESC;
```

Counts of opens and threshold crossings, not unique visitors or completed actions.
Never sum cumulative active-time thresholds as duration. No raw events/browser history.
`node --test worker.test.mjs` uses real in-memory SQLite with fictional requests.
