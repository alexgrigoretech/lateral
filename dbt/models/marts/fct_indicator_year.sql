select
    spine.country_iso3,
    spine.indicator_code,
    spine.year,
    o.value,
    case
        when o.value is not null then 'present'
        when o.page_id is not null then 'null_value'
        else 'not_returned'
    end as status,
    o.value is null as is_missing,
    o.page_id as source_page_id,
    o.row_index as source_row_index,
    o.source_lastupdated,
    o.fetched_at,
    current_timestamp as loaded_at
from {{ source('raw', 'config_spine') }} spine
left join {{ ref('stg_observations') }} o
    on spine.country_iso3 = o.country_iso3
    and spine.indicator_code = o.indicator_code
    and spine.year = o.year