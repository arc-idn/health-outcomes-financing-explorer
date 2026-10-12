# Extract the capital series from the same frozen GHED workbook as the financing explorer.
# Run from the repository root: Rscript work/health-outcomes/build_capital.R
library(readxl)
library(jsonlite)
library(digest)
source <- Sys.getenv("GHED_XLSX", unset = "sources/ghed/GHED_data_2026-05-28.xlsx")
output <- if (dir.exists("work/health-outcomes/preview")) "work/health-outcomes/preview" else "site/tools/health-outcomes"
codes <- names(fromJSON("site/tools/health-outcomes/data/outcomes.json", simplifyVector = FALSE)$countries)
# Preserve the producer's exact code, unit and definition; missing cells stay missing.
capital_fields <- c("hk_usd2023_pc", "hk_usd_pc")
fields <- c("code", "year", capital_fields)
header <- names(read_excel(source, sheet = "Data", n_max = 0))
stopifnot(all(fields %in% header))
types <- ifelse(header %in% fields, "text", "skip")
raw <- read_excel(source, sheet = "Data", col_types = types)
raw <- raw[raw$code %in% codes, ]
raw$year <- as.integer(raw$year)
for (field in capital_fields) {
  numeric_capital <- suppressWarnings(as.numeric(raw[[field]]))
  invalid <- unique(raw[[field]][is.na(numeric_capital) & !is.na(raw[[field]]) &
    !trimws(raw[[field]]) %in% c("", "-", "..", "...", "NA", "N/A", "n/a")])
  if (length(invalid)) stop("Unrecognised capital source values: ", paste(invalid, collapse = ", "))
  raw[[field]] <- numeric_capital
  stopifnot(all(raw[[field]] >= 0, na.rm = TRUE))
}
stopifnot(!anyDuplicated(paste(raw$code, raw$year)))
raw <- raw[order(raw$code, raw$year), ]
book <- read_excel(source, sheet = "Codebook")
definition <- book[book$`variable code` == "hk_usd2023_pc", ]
stopifnot(nrow(definition) == 1)
countries <- setNames(lapply(codes, function(iso) {
  series <- setNames(lapply(capital_fields, function(field) {
    x <- raw[raw$code == iso & !is.na(raw[[field]]), ]
    as.list(setNames(x[[field]], x$year))
  }), capital_fields)
  list(series = series)
}), codes)
indicators <- setNames(lapply(capital_fields, function(field) {
  row <- book[book$`variable code` == field, ]
  stopifnot(nrow(row) == 1)
  list(code = field, definition = row$`variable name`,
       unit = if (field == "hk_usd_pc") "current US$ per capita" else "constant 2023 US$ per capita")
}), capital_fields)
payload <- list(
  source = "WHO Global Health Expenditure Database", url = "https://apps.who.int/nha/database/",
  retrieved = "2026-05-28", extracted = "2026-10-03", source_file = basename(source),
  source_sha256 = digest(source, algo = "sha256", file = TRUE),
  code = "hk_usd2023_pc", definition = definition$`variable name`,
  unit = "constant 2023 US$ per capita", indicators = indicators, countries = countries,
  note = "Capital expenditure (HK) is separate from current health expenditure (CHE). No missing value is set to zero."
)
dir.create(file.path(output, "data"), recursive = TRUE, showWarnings = FALSE)
write_json(payload, file.path(output, "data/capital.json"), auto_unbox = TRUE, na = "null", null = "null", digits = NA)
dir.create("work/health-outcomes/raw", recursive = TRUE, showWarnings = FALSE)
write.csv(raw, "work/health-outcomes/raw/ghed_capital_2026-05-28.csv", row.names = FALSE, na = "")
cat(sum(!is.na(raw$hk_usd2023_pc)), "capital observations in", sum(vapply(countries, function(x) length(x$series$hk_usd2023_pc) > 0, logical(1))), "countries\n")
for (iso in c("IDN", "THA", "MYS", "VNM", "PHL", "SGP")) {
  x <- raw[raw$code == iso & raw$year >= 2003 & raw$year <= 2023, ]
  cat(iso, sum(!is.na(x$hk_usd2023_pc)), "/", nrow(x), "years, 2023:", x$hk_usd2023_pc[x$year == 2023], "\n")
}
