# Teacher Treasure

**Hidden deals. Bigger classroom wins.**

Teacher Treasure is a mobile-friendly, installable web app for finding verified educator freebies, discounts, technology offers, classroom resources, and Fort Worth-area benefits.

## Live app

`https://duhfreakinduh.github.io/teacher-treasure/`

## Release features

- Verified listings linked directly to official sources
- Visible last-checked dates, eligibility, deadlines, and savings labels
- Search, category, offer-type, location, and expiration filters
- Saved favorites stored privately on the device
- Personal category watch list stored privately on the device
- Community-added local deals with clear unverified labeling
- GitHub issue forms for community submissions and outdated-deal reports
- Share controls with clipboard fallback
- Installable Progressive Web App support
- Offline shell and cached deal data
- Responsive layout and keyboard-accessible controls
- Automated JavaScript and deal-data validation
- Zero runtime dependencies and no build step

## Data policy

Every published seed listing must:

1. Link to an official organization source, not a search-results page.
2. Include an ISO `lastVerified` date.
3. State eligibility and important limitations.
4. Include a known expiration date when the official source provides one.
5. Be removed or updated when the source no longer supports the claim.

Offers can change without notice. Teacher Treasure is a directory, not a guarantee or endorsement.

## Run locally

The app loads JSON with `fetch`, so serve the folder through a local web server:

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`.

## Validate

```bash
node --check app.js
python3 scripts/validate_deals.py
python3 -m json.tool data/deals.json >/dev/null
python3 -m json.tool manifest.webmanifest >/dev/null
```

## Publish with GitHub Pages

The included GitHub Actions workflow deploys pushes to `main`. In repository **Settings → Pages**, set the source to **GitHub Actions**.

## Add or update a deal

Edit `data/deals.json` and keep the existing schema. The validation workflow rejects missing fields, duplicate IDs or URLs, invalid dates, search-engine URLs, and verified records without a verification date.

Community members can also use the repository's **Submit a teacher deal** issue form.

## License

MIT
