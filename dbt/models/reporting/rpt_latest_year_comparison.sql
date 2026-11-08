with latest as (
    select indicator_code, max(year) as year
    from {{ ref('fct_indicator_year') }}
    where status = 'present'
    group by indicator_code
)
select
    f.country_iso3,
    f.indicator_code,
    f.year,
    f.value,
    case when f.value is not null then
        rank() over (partition by f.indicator_code order by f.value desc nulls last)
    end as rank,
    case when i.is_additive then
        f.value / nullif(sum(f.value) over (partition by f.indicator_code), 0)
    end as share_of_total
from {{ ref('fct_indicator_year') }} f
join latest using (indicator_code, year)
join {{ ref('dim_indicator') }} i using (indicator_code)