# Environment variables

## Required

- `JWT_SECRET` — at least 32 characters.

## PhonePe (subscription checkout)

- `PHONEPE_BASE` — e.g. `https://api-preprod.phonepe.com/apis/pg-sandbox` (sandbox) or production `https://api.phonepe.com/apis/pg`.
- `MERCHANT_ID`, `SECRET` — OAuth client credentials (see PhonePe dashboard).
- `PHONEPE_CLIENT_VERSION` — defaults to `1`.
- `SALT_KEY` — used for legacy checksum flows if applicable.
- `REDIRECT_URL` — post-checkout redirect.

## Pricing

- `PREMIUM_PLAN_AMOUNT_INR` — display base price (default `499`).
- `PREMIUM_SETUP_AMOUNT_PAISA` — optional override for first charge in paisa (default `PREMIUM_PLAN_AMOUNT_INR * 100`).
- `GST_DISPLAY_NOTE` — e.g. `+ GST` (UI / API metadata only).
- `PREMIUM_PLAN_ID` — defaults to `premium_monthly`.

## Free tier & builder

- `FREE_STANDARD_ANALYSIS_LIMIT` — default `3`.
- `FREE_JD_MATCH_LIMIT` — default `1`.
- `STANDARD_ANALYSES_BEFORE_WOW` — 0-based index before next run becomes “wow”; default `1` (second analysis shows premium once).
- `FREE_BUILDER_TEMPLATES` — comma-separated slugs, default `modern,corporate,faang`.

## Subscription window

- `SUBSCRIPTION_PERIOD_DAYS` — days added to `premiumUntil` on each successful charge (default `30`).

## Webhooks

Configure in PhonePe Business dashboard:

- Callback URL: `https://<your-api-host>/api/webhooks/phonepe`
- Username / password for `Authorization: SHA256(username:password)` verification.

Set on the API:

- `PHONEPE_WEBHOOK_USERNAME`
- `PHONEPE_WEBHOOK_PASSWORD`

If these are unset, the server **accepts** webhooks without auth (development only — set credentials in production).
