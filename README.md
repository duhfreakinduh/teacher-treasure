# Teacher Treasure

A mobile-friendly, installable web app for discovering and tracking educator freebies, discounts, giveaways, grants, and local resources.

## What is included

- Search and filter teacher offers
- Free, discount, giveaway, and grant categories
- Online and local listings
- Saved favorites stored on the device
- Community deal submission form stored on the device
- Deal alert preferences stored on the device
- Live deal-scout search shortcuts using current keywords
- GitHub issue form for community deal submissions
- App icons for installable PWA support
- Safety and verification reminders
- Progressive Web App support
- Zero dependencies and no build step

## Important MVP note

The included listings are clearly marked demo records. Replace them with verified current offers before publicly promoting the app. Offers change frequently, so every listing should include an official source URL, a last-checked date, and an expiration date when known.

## Run locally

Because the app loads JSON with `fetch`, serve the folder through a local web server instead of opening `index.html` directly.

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Publish with GitHub Pages

1. Open **Settings → Pages**.
2. Under **Build and deployment**, select **GitHub Actions**.
3. The included workflow will publish the site.

## Recommended Phase 2 architecture

- Frontend: Next.js or the existing static PWA
- Database/auth: Supabase
- Deal ingestion: scheduled server functions using approved APIs, RSS feeds, newsletters, and manual moderator submissions
- Notifications: Resend or SendGrid email alerts
- Geography: city, ZIP code, state, and nationwide targeting
- Moderation: pending, verified, expired, rejected, and reported statuses
- Automation: daily expiration checks and source re-verification

Do not scrape websites that prohibit automated access. Prefer official APIs, RSS feeds, affiliate feeds, newsletters, and community submissions.

## Suggested data model

```text
Deal
- id
- title
- organization
- type
- category
- description
- official_url
- location_type
- city
- state
- nationwide
- eligibility
- expiration_date
- last_verified_at
- verification_status
- submitted_by
- saves_count
- report_count
```

## License

MIT
