# Dynatrace User Adoption

Standalone Dynatrace AppEngine application for Axis Bank user adoption analytics.

## Phase 1
- Live Grail query for Dynatrace login audit events
- 7 / 15 / 30 day windows
- Unique active users
- Login-event count
- Daily active-user trend
- Last login / active days / login count
- Management Zone field reserved for Phase 2 enrichment

## Deployment
Target: `https://axis-prod.apps.dynatrace.com/`
Application ID: `my.axis.dynatrace.user.adoption`

```bash
npm ci
npx dt-app analyze
npx dt-app build
npx dt-app deploy --dry-run
npx dt-app deploy
```

Do not commit credentials or tenant tokens.
