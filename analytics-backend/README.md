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

## Additional aggregate reports (v3, 12 October 2026)

Backend must be deployed before the client: new fixed labels are additive; old
clients remain compatible. No schema migration or additional privileges needed.

```sql
SELECT day, metric, label, total FROM counts
WHERE metric IN ('browser','os','device','referral','navigation','active_page','load','ttfb','fcp')
ORDER BY day DESC, metric, total DESC;
```

Divide a category by its own metric total, never overall page opens: older saved
choices retain earlier scope. Device estimates are not unique people. Timings
include unavailable separately; do not compute exact averages from ranges.
Page pairs are aggregate arrivals, not individual journeys. See ANALYTICS.md for
the purpose audit, limits, and why unique visitor estimation is not implemented.
