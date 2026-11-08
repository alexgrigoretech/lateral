select
    country_iso3,
    indicator_code,
    count(*) as expected_years,
    count(value) as present_years,
    count(*) - count(value) as missing_years,
    100.0 * count(value) / count(*) as completeness_pct,
    min(year) filter (where status = 'present') as first_year_present,
    max(year) filter (where status = 'present') as last_year_present
from {{ ref('fct_indicator_year') }}
group by country_iso3, indicator_code