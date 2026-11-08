select
    f.country_iso3,
    c.country_name,
    f.indicator_code,
    i.label,
    f.year,
    f.status
from {{ ref('fct_indicator_year') }} f
join {{ ref('dim_country') }} c using (country_iso3)
join {{ ref('dim_indicator') }} i using (indicator_code)
where f.status <> 'present'