{{ config(severity='warn') }}
select *
from {{ ref('rpt_yoy_change') }}
where indicator_code = 'SP.POP.TOTL' and yoy_status = 'ok' and abs(pct_change) > 10