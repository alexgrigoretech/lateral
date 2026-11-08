select
    f.indicator_code,
    coalesce(c.income_level_code, 'UNK') as income_level_code,
    coalesce(c.income_level_name, 'Unknown') as income_level,
    f.year,
    count(*) as country_count,
    count(f.value) as countries_present,
    case when i.is_additive then sum(f.value) end as sum_value,
    avg(f.value) as avg_value,
    median(f.value) as median_value,
    case
        when f.indicator_code in ('NY.GDP.PCAP.CD', 'SP.DYN.LE00.IN')
             and count(f.value) > 0
             and count(*) filter (where p.value is null or p.value <= 0) = 0
        then sum(f.value * p.value) filter (where f.value is not null)
             / nullif(sum(p.value) filter (where f.value is not null), 0)
    end as population_weighted_avg,
    min(f.value) as min_value,
    max(f.value) as max_value
from {{ ref('fct_indicator_year') }} f
join {{ ref('dim_country') }} c using (country_iso3)
join {{ ref('dim_indicator') }} i using (indicator_code)
left join {{ ref('fct_indicator_year') }} p
    on p.country_iso3 = f.country_iso3
    and p.year = f.year
    and p.indicator_code = 'SP.POP.TOTL'
group by f.indicator_code, c.income_level_code, c.income_level_name, f.year, i.is_additive