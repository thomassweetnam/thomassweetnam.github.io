# Dog Picker Showdown

Local breed tournament site built from the AKC dog breed directory at `https://www.akc.org/dog-breeds/`.

## What it does

- Scrapes every paginated AKC breed listing page.
- Downloads the breed card images locally.
- Generates `site/data/breeds.json` and `site/data/breeds.js`.
- Runs a local browser bracket where you choose between two dogs until one champion remains.

## Run the scraper

```bash
python3 scripts/scrape_akc_breeds.py
```

The scraper writes image assets into `site/assets/images/` and data files into `site/data/`.

## Open the site

You can open `site/index.html` directly, since the generated breed data is loaded from a local JavaScript file.

If you prefer serving it over HTTP instead:

```bash
python3 -m http.server 8000
```

Then open `http://127.0.0.1:8000/site/`.

## Notes

- The scraper was written against the AKC listing markup observed on March 13, 2026.
- If AKC changes the listing structure or pagination, rerun the scraper after updating `scripts/scrape_akc_breeds.py`.
