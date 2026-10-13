# Health Outcomes & Financing Explorer

A browser tool comparing health outcomes, service coverage, financial protection and
MDG/SDG progress with health financing for 195 countries, against regional,
income-group, global and ASEAN peer medians.

This repository holds everything the tool needs: the application, its published data,
the health financing data it reads, the frozen source responses and the scripts that
rebuild the data from them.

## Microsite
https://arc-idn.github.io/health-outcomes-financing-explorer/tools/health-outcomes/
Password: nectar-6934

## Run it locally

No build step is needed. Serve the `site/` folder and open the tool:

```
python3 -m http.server 8000 -d site
# then open http://localhost:8000/tools/health-outcomes/
```

## Contents

| Path | What it is |
|---|---|
| `site/tools/health-outcomes/` | The application (HTML, CSS, JavaScript) and its data (`data/outcomes.json`, `outcomes.csv`, `capital.json`) |
| `site/tools/health-financing/data/` | The WHO GHED financing panel the tool reads (`core.json`, `detail.json`, `meta.json`) |
| `site/tools/health-financing/assets/tokens.css` | Shared design tokens used by the page |
| `work/health-outcomes/source/` | Frozen World Bank WDI and WHO GHO responses, with metadata and retrieval record |
| `work/health-outcomes/raw/` | Capital-spending extract from WHO GHED |
| `work/health-outcomes/*.py, *.R, *.mjs` | Data builders and tests |
| `sources/ghed/GHED_data_2026-05-28.xlsx` | WHO Global Health Expenditure Database workbook (28 May 2026 download) |

## Rebuild the data

From the repository root:

```
python3 work/health-outcomes/build_data.py                     # outcomes.json, outcomes.csv
Rscript work/health-outcomes/build_capital.R                     # capital.json
node --test work/health-outcomes/analytics.test.mjs            # 25 tests
```

The builders read only the frozen files in this repository; they make no network
calls unless run with `--refresh`, which retrieves new observations and creates a new
data vintage. Rebuilding from the included sources reproduces the published
`outcomes.json`, `outcomes.csv` and `capital.json` byte for byte. R needs `readxl`,
`jsonlite` and `digest`; `build_data.py` needs Python 3 and `requests`.
`work/health-outcomes/validate.py` is an optional browser check that needs Playwright.
The financing files in `site/tools/health-financing/data/` are included as published
inputs; they are not rebuilt here.

`work/health-outcomes/README.md` documents the indicator definitions, source decisions
and comparison rules.

## Interpretation

This is a descriptive monitoring tool. It does not estimate the effect of financing on
outcomes, rank efficiency or produce a composite score. Peer medians are unweighted
country medians that exclude the selected country. Out-of-pocket share is not a
measure of financial hardship, and 2024 financing observations are preliminary.

## Data sources and terms

- World Bank, World Development Indicators (21 indicators), CC BY 4.0.
- World Health Organization, Global Health Observatory: UHC service coverage index and
  financial hardship series, 2025 revision.
- World Health Organization, Global Health Expenditure Database, May 2026 release.

WHO data are subject to WHO's terms of use, generally CC BY-NC-SA 3.0 IGO. Cite the
original providers when reusing the data. No licence is granted here for the
application code.
