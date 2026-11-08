select
    trim(r.country_iso3) as country_iso3,
    trim(r.country_iso2) as country_iso2,
    trim(r.name) as country_name,
    trim(r.income_level_code) as income_level_code,
    trim(r.income_level_name) as income_level_name,
    trim(r.region_code) as region_code,
    trim(r.region_name) as region_name,
    trim(r.lending_type) as lending_type,
    trim(r.capital_city) as capital_city,
    try_cast(nullif(trim(r.latitude), '') as double) as latitude,
    try_cast(nullif(trim(r.longitude), '') as double) as longitude,
    r.page_id
from {{ source('raw', 'country_rows') }} r
join {{ source('raw', 'page_sightings') }} s using (page_id)
join {{ source('raw', 'runs') }} u on s.run_id = u.run_id
where u.status in ('success', 'running')
qualify row_number() over (
    partition by r.country_iso3
    order by s.fetched_at desc, u.started_at desc, r.page_id desc, r.row_index desc
) = 1