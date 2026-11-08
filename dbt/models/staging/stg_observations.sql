select
    trim(r.country_iso3) as country_iso3,
    trim(r.indicator_code) as indicator_code,
    cast(r.year as integer) as year,
    r.value,
    trim(r.obs_status) as obs_status,
    trim(r.unit) as unit,
    try_cast(r.decimal as integer) as decimal,
    p.source_lastupdated,
    r.page_id,
    r.row_index,
    s.fetched_at
from {{ source('raw', 'observation_rows') }} r
join {{ source('raw', 'api_pages') }} p using (page_id)
join {{ source('raw', 'page_sightings') }} s using (page_id)
join {{ source('raw', 'runs') }} u on s.run_id = u.run_id
where u.status in ('success', 'running')
qualify row_number() over (
    partition by r.country_iso3, r.indicator_code, r.year
    order by s.fetched_at desc, u.started_at desc, r.page_id desc, r.row_index desc
) = 1