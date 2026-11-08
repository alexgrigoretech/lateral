select 'spine_count_mismatch' as failure
where (select count(*) from {{ ref('fct_indicator_year') }})
   <> (select count(*) from {{ source('raw', 'config_spine') }})