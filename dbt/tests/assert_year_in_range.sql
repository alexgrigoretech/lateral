select *
from {{ ref('fct_indicator_year') }}
where year < {{ var('year_start') }} or year > {{ var('year_end') }}