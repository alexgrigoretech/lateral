select
    spine.country_iso3,
    c.country_iso2,
    c.country_name,
    c.income_level_code,
    c.income_level_name,
    c.region_code,
    c.region_name,
    c.lending_type,
    c.capital_city,
    c.latitude,
    c.longitude,
    c.page_id as source_page_id
from (select distinct country_iso3 from {{ source('raw', 'config_spine') }}) spine
left join {{ ref('stg_countries') }} c using (country_iso3)