select
    trim(r.indicator_code) as indicator_code,
    trim(r.name) as name,
    trim(r.unit) as unit,
    trim(r.source_note) as source_note,
    trim(r.source_organization) as source_organization,
    r.page_id
from {{ source('raw', 'indicator_meta_rows') }} r
join {{ source('raw', 'page_sightings') }} s using (page_id)
join {{ source('raw', 'runs') }} u on s.run_id = u.run_id
where u.status in ('success', 'running')
qualify row_number() over (
    partition by r.indicator_code
    order by s.fetched_at desc, u.started_at desc, r.page_id desc, r.row_index desc
) = 1