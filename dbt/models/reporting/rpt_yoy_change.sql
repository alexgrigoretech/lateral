with prior as (
    select
        country_iso3,
        indicator_code,
        year,
        value,
        lag(year) over yearly as prior_year,
        lag(value) over yearly as prior_value
    from {{ ref('fct_indicator_year') }}
    window yearly as (partition by country_iso3, indicator_code order by year)
), changes as (
    select *,
        case
            when prior_year is null then 'first_year'
            when value is null then 'current_missing'
            when prior_value is null then 'prior_missing'
            when prior_value = 0 then 'prior_zero'
            else 'ok'
        end as yoy_status
    from prior
)
select
    country_iso3,
    indicator_code,
    year,
    value,
    prior_year,
    prior_value,
    value - prior_value as abs_change,
    case when yoy_status = 'ok'
         then 100.0 * (value - prior_value) / nullif(prior_value, 0)
    end as pct_change,
    yoy_status
from changes