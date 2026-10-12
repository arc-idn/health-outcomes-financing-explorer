# Health Outcomes & Financing Explorer

Canonical application: `site/tools/health-outcomes/`.

The policy question is whether changes in health financing accompany changes in
population outcomes, service coverage and progress against MDG/SDG indicators.
The unit is country-year, within the existing 195-country financing universe.
Twenty-three indicators cover health outcomes, service coverage, financial
protection, nutrition and living conditions. The default trend window is
2003–2023; health observations span 1990–2024 where available.

This is a descriptive monitoring module. It does not infer financing effects,
rank efficiency or treat coverage as a measure of service quality. There is no
composite performance score. Exact-year comparisons and missingness are visible.

## Rebuild

```
python3 work/health-outcomes/build_data.py
Rscript work/health-outcomes/build_capital.R
node --test work/health-outcomes/analytics.test.mjs
python3 work/health-outcomes/validate.py
```

The builder uses the frozen compressed source responses and metadata in `source/`.
`--refresh` deliberately retrieves new official observations and records a new
retrieval date. Review source/method changes, coverage and rendered comparisons
before exposing a refreshed payload. Future observations beyond 2024 also require
updating the UI's selectable bounds and tests; a refresh is not an automatic release.

The builder writes into `preview/data` when that staging directory exists;
otherwise it rebuilds the canonical application's `data/` directory. Preview
validation uses Playwright request interception against the site served locally
(`python3 -m http.server 8000 -d site`, or set `BASE_URL`); it starts no server itself. The only Python dependency beyond the standard library for
building is requests; browser validation uses the existing Playwright installation.

## Source decisions

- Twenty-one World Bank WDI indicators are frozen with full provider metadata,
  API URL, database update date and the SHA256 of the compressed source response.
- UHC coverage and financial hardship come directly from the WHO GHO country
  endpoints, using the 2025 revision. The World Bank UHC series is archived and
  is not used. The WHO report's “full dataset” link currently supplies regional
  aggregates; these are not country observations and are not used.
- Hardship uses `FINANCIALHARDSHIPCOMPONENT_COMPONENT_TOTAL`, with no secondary
  disaggregation. Duplicate country-years, pagination and censored source values
  fail the builder rather than being silently merged or coerced.
- The existing financing `core.json`, `detail.json` and `meta.json` are read by
  the browser directly. They are not copied, refreshed or re-estimated.
- Government health expenditure is GGHE-D, not the broader compulsory-financing
  category. Out-of-pocket share is not financial hardship. Current PPP dollars
  are not constant-price dollars. 2024 financing observations are preliminary.

## Comparison rules

The Country trends view now plots five series: the selected country and
regional, same-income, global and ASEAN peer medians. Peer lines can be toggled.
Each group excludes the selected country; global is an unweighted country median,
not a population-weighted global estimate. The default cohort includes only peers
observed in every selected year, holding membership constant. Users can explicitly
select annual available-country medians for sparse survey data; changing sample
composition is labelled and the annual denominator is exposed. Each chart derives
its own eligible cohort, because outcome and financing availability differs.

Three scales share the same data: source levels, each series' baseline rebased to
100, and absolute change from that baseline. Indexing requires a nonzero baseline.
The gap table is selected-country value minus peer median in original units at
baseline and endpoint. Hover, tap and arrow keys reveal year-specific values and
sample sizes. The CSV contains both source and transformed values, group,
membership rule, baseline, contributing-country count and eligible-country count.

Trends show exact values and break at missing years. Financing comparisons pair
outcome year t with financing year t, t−3 or t−5. Incomplete pairs remain visible
in the table. Medians exclude the focus country and use unweighted complete peers.
Peer groups follow the existing fixed-2023 financing classification and its
11-country ASEAN preset. The focus country remains visible outside that preset.

The MDG scorecard uses exact 1990 and 2015 values. The SDG scorecard uses an exact
2015 baseline and the latest available observation up to the selected year,
always displaying its actual year. No mixed-year cross-country ranking is made.
Numeric assessments cover MDG child/maternal mortality and SDG child, neonatal
and premature NCD mortality. The maternal SDG threshold is labelled a global
benchmark, never country achievement. Other indicators are tracked without
inventing numerical pass/fail rules; subset and component mappings are explicit.

Data points can be modelled estimates or survey observations. Uncertainty
intervals are not present in this extract, and threshold labels assess point
estimates only. No interpolation is introduced by this module.

## Five-year country trajectories and accumulated expenditure

Plot 3 in Country trends has outcome on X and financing on Y. Dots mark the
baseline, baseline + 5, + 10 and so on, with no irregular last-year addition.
Countries have separate chronological lines. Missing paired observations break
the line. The focus country is always present and up to seven other countries
can be selected. The country picker keeps its search, scroll and focus while
the chart refreshes. Comparison settings persist in the URL.

Plot 3 also has its own grouped outcome selector, covering all 23 indicators.
It stays synchronised with the main Health indicator and Indicator group controls,
and preserves the reader's scroll position when changing the outcome locally.

Actual values and baseline = 100 are explicit toggles. In indexed mode, both
axes use the respective country's exact nonzero baseline. The first two charts
retain their own actual/index/change toggle and peer settings.

Annual financing can use chart 2's indicator, current health expenditure per
capita (CHE), capital expenditure per capita (HK), or CHE + HK. For the latter
three choices, Spending prices toggles nominal current US dollars versus real
constant 2023 US dollars. Price basis is separate from baseline indexing; rebasing
does not adjust inflation. Chart 2's measure retains its stated units and does
not enable this price toggle. Cumulative mode only permits real expenditure flows,
never a sum of GDP shares or other percentages. It sums every year inclusively
from baseline through the observation year, not only the displayed five-year
points. One missing intervening year makes that and later cumulative totals
unavailable. No partial sum is presented as a complete total. Population changes
mean this is a sum of annual per-capita flows, not a lifetime cost per person.
Accumulated capital expenditure is not an asset stock net of depreciation.

`build_capital.R` uses readxl, jsonlite and digest to extract `hk_usd2023_pc`
and nominal `hk_usd_pc`
from the same frozen May 2026 GHED workbook used by the financing explorer.
The workbook is in `sources/ghed/`; set `GHED_XLSX` to use another copy. The source workbook hash and exact
producer definition travel in `data/capital.json`; the extracted country-year
table is frozen at `raw/ghed_capital_2026-05-28.csv`. There are 2,210 reported
real capital observations in 146 countries and 2,231 nominal observations.
Each series keeps its own availability; one is never substituted for the other.
Indonesia's capital data end in 2019,
Thailand's in 2018 and Malaysia's in 2019; the Philippines has data through 2023.
CHE is not copied or changed. The new payload supplies only the capital series
that the existing financing explorer did not expose.

The trajectory CSV contains every annual observation behind the plotted dots,
component units and source codes, source values, transformed coordinates,
baseline denominators, sampling/availability flags and counts of observed versus
required spending years, plus the selected price basis. A values table exposes
missingness beside the plot.

The dropdown regression came from a delegated click selector matching the
body's `data-view` styling attribute, so any ordinary click rerendered the app
and prevented its default action. The handler now matches navigation links and
buttons only. Browser checks exercise actual opening clicks as well as selection.

## Deployment

Static native ES modules and SVG, matching the existing navy/Georgia/Arial site.
No new framework, external script, service, port, credential or authentication
change. Update `site/works.json` only after the module is validated. Cache tags
must change when editing a deployed HTML/JS/CSS release. Before replacing an
existing release, retain its git commit. The other six products and annotation
system are outside this change.

Validation evidence: `docs/health-outcomes-validation.json`. Regenerable browser
screenshots, CSV download and print sample are under the ignored directory
`docs/screenshots/health-outcomes/`.
