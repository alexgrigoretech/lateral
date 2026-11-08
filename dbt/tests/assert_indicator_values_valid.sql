select *
from {{ ref('fct_indicator_year') }}
where status = 'present'
    and (
        (indicator_code in ('SP.POP.TOTL', 'NY.GDP.MKTP.CD') and value <= 0)
        or (indicator_code = 'SP.DYN.LE00.IN' and (value < 20 or value > 100))
        or not isfinite(value)
    )