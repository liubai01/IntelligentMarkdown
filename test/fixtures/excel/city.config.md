# Excel City Fixture

This fixture demonstrates Excel table preview/edit for the `City` sheet in `city.xlsx`.

## Full Preview (all rows in sheet)

```lua-config
file: ./city.xlsx
key: City
type: table
label: Global City Metrics (City sheet)
columns:
  - { key: "City", label: "City", type: "string", width: "220px" }
  - { key: "Country", label: "Country", type: "string", width: "130px" }
  - { key: "Metro Population (2025 est.)", label: "Metro Pop (2025)", type: "string", width: "160px" }
  - { key: "Total GDP (USD)", label: "Total GDP", type: "string", width: "130px" }
  - { key: "GDP per Capita (USD)", label: "GDP/Capita", type: "string", width: "130px" }
  - { key: "Avg. Monthly Net Salary (After Tax, USD)", label: "Net Salary / Month", type: "string", width: "190px" }
  - { key: "Cost of Living Index (NYC=100)", label: "Cost Index", type: "number", min: 0, max: 200, step: 0.1, width: "140px" }
```

## Tail Window Example (performance-friendly)

```lua-config
file: ./city.xlsx
key: City
type: table
label: City Metrics (tail window: last 8 rows, max 5 returned)
tailRows: 8
maxRows: 5
columns:
  - { key: "City", label: "City", type: "string", width: "220px" }
  - { key: "Country", label: "Country", type: "string", width: "130px" }
  - { key: "Cost of Living Index (NYC=100)", label: "Cost Index", type: "number", min: 0, max: 200, step: 0.1, width: "140px" }
  - { key: "Avg. Monthly Net Salary (After Tax, USD)", label: "Net Salary / Month", type: "string", width: "190px" }
```

