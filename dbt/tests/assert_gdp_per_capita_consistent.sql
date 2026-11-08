select
    g.country_iso3,
    g.year,
    g.value as gdp,
    p.value as population,
    c.value as gdp_per_capita,
    abs(c.value - g.value / nullif(p.value, 0)) / nullif(c.value, 0) as relative_error
from {{ ref('fct_indicator_year') }} g
join {{ ref('fct_indicator_year') }} p
    on p.country_iso3 = g.country_iso3 and p.year = g.year and p.indicator_code = 'SP.POP.TOTL'
join {{ ref('fct_indicator_year') }} c
    on c.country_iso3 = g.country_iso3 and c.year = g.year and c.indicator_code = 'NY.GDP.PCAP.CD'
where g.indicator_code = 'NY.GDP.MKTP.CD'
    and g.status = 'present' and p.status = 'present' and c.status = 'present'
    and (p.value <= 0 or c.value <= 0 or
         abs(c.value - g.value / nullif(p.value, 0)) / nullif(c.value, 0) > {{ var('consistency_tolerance', 0.01) }})