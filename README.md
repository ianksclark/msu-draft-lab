# MSU Draft Lab — editable website

This is the **same v0.5 Fearless BO3/BO5 companion**, reorganized into a maintainable static website. It is not a new statistical-data refresh. The source data remains a patch **26.19–26.20 snapshot**, and missing/uncertain matchups remain uncertain.

## Start using it

- **Simplest:** Unzip the entire folder and double-click `index.html` in Chrome/Edge.
- **More reliable local URL:** With Python installed, open a terminal in this directory, run `python -m http.server 8000`, and visit `http://localhost:8000`.
- No Riot API, database server, or paid account is needed. The browser runs all drafting calculations.

## Keep your existing work

1. Before moving from v0.5, open the old HTML and click **Export JSON**.
2. Open this website and click **Import**, then choose the saved JSON.
3. Export a new JSON after any major changes.

Browser data is saved locally for the current website address. Moving from a file URL to `localhost`, to GitHub Pages, or to a different device **does not migrate data automatically**. Import your backup again after changing address. Multiple teammates do **not** automatically share data.

## Change without coding

| Item | Where |
|------|-------|
| Player champion pools and comfort | **Champion pools** tab |
| Blind pick / conditional blind notes | **Champion pools** tab |
| Matchup and synergy custom ratings | **Synergies & counters** tab |
| Opponent scouting | **Series HQ** tab |
| BO3/BO5 settings and game results | **Series HQ** tab |
| Prepared comps | **Series HQ** tab |
| Import sourced numerical statistics | **Statistics** tab |

Click **Export JSON** to preserve all the above settings and series drafts.

## Change with code (or ask ChatGPT to change the files)

| File | Purpose |
|------|---------|
| `index.html` | Website layout, sections and labels |
| `assets/styles.css` | All styling and responsive layout |
| `assets/app.js` | Draft scoring, fearless series state, saving, UI logic |
| `assets/data/champions.js` | Full champion list, MSU default pools, tags, starter rules |
| `assets/data/current-stats.js` | Matchup and synergy observations, sample sizes, source references |
| `assets/data/historic-stats.js` | Historical observations (not automatically scored) |
| `assets/data/legacy-archive.js` | Older observations kept for reference, not enabled by default |
| `tests/smoke_test.py` | Basic browser regression tests |

If editing a source data file, ensure every champion name and role is consistent. Use `TOP`, `JUNGLE`, `MID`, `ADC`, `SUPPORT`. If you update statistics, cite the real source URL, patch, sample size and rank filter. **Do not mix rank brackets or patch windows without labeling them.**

## Publish as an actual website (GitHub Pages)

1. Create a GitHub repository (private if you want private code). Upload the entire contents of this folder, keeping `index.html` at the root.
2. For a public repo, open **Settings → Pages → Build and deployment → Deploy from a branch**, select `main` and `/ (root)`, and save. Alternatively use another static host that accepts these files.
3. GitHub shows your site URL after publishing, commonly `https://YOUR-USERNAME.github.io/REPOSITORY/`.
4. When code changes, upload/commit the changed files. Visitors see the new version at the same link after deployment.

**Privacy:** GitHub Pages is designed for publicly accessible sites. Do not commit private opponent scouting profiles, confidential notes, or exported JSON backups to a public repository. The app saves scouting data in your browser, not in these source files. For private team-wide access and sync, we would need authentication and a backend in a future version.

## Fearless and data limitations

- The app mirrors fearless exclusions from previous games; Drafter remains the official drafting interface.
- The app doesn't automatically read Drafter/OP.GG/Beer League pages. Enter picks manually and import supported JSON.
- Statistical records are fixed snapshots, not automatically refreshed. Don't treat heuristic scores as probabilities.
- Keep browser exports; there is no cloud backup or cross-device sync in this version.

## Quick regression check

With Python Playwright installed and Chromium available, run `python tests/smoke_test.py`. The basic test verifies pages load, the enemy champion picker, BO3 lockouts, and no JavaScript errors.
