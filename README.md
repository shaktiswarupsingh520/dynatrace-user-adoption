# Dynatrace User Adoption

Standalone Dynatrace AppEngine application for Axis Bank adoption analytics.

## Current model

The supplied user-base workbook is the authoritative population and user-to-Management-Zone/application assignment source. Raw user identifiers are not committed to GitHub. A SHA-256 mapping is placed locally before deployment so the app can join the reference population to Dynatrace LOGIN activity without storing raw LDAP data in the repository.

The application:
- supports 7 / 15 / 30 day windows
- queries Grail with aggregation instead of downloading raw login events
- uses `maxResultRecords: 10000` for aggregated user-level results
- calculates active/inactive against the supplied population
- calculates MZ-wise user, active, inactive and adoption counts
- drills into an MZ to show users
- drills into a user to show daily login activity
- preserves multiple MZ/application assignments per user

## Before local build/deploy

Copy the generated privacy-safe reference file into:

```text
public/data/user-mz-master.json
```

The file is intentionally excluded from the repository because the source workbook contains user information.

## Commands

```bash
npm install
npm run typecheck
npm run build
npm run dt:analyze
npm run dt:dry-run
npm run dt:deploy
```

Target: `https://axis-prod.apps.dynatrace.com/`
Application ID: `my.axis.dynatrace.user.adoption`

Do not commit raw LDAP/user exports, passwords, tokens, or tenant credentials.
