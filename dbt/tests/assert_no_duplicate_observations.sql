select country_iso3, indicator_code, year, count(*) as records
from {{ ref('stg_observations') }}
group by country_iso3, indicator_code, year
having count(*) > 1