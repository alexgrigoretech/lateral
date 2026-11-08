with latest as (
    select country_iso3, indicator_code, year, value
    from {{ ref('fct_indicator_year') }}
    where status = 'present'
    qualify row_number() over (
        partition by country_iso3, indicator_code order by year desc
    ) = 1
)
select p.country_iso3, p.indicator_code, l.year, l.value
from (
    select distinct country_iso3, indicator_code from {{ ref('fct_indicator_year') }}
) p
left join latest l using (country_iso3, indicator_code)