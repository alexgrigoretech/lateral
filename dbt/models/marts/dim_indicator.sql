with configured as (
    {% for indicator in var('indicators') %}
    select
        '{{ indicator.code | replace("'", "''") }}'::varchar as indicator_code,
        '{{ indicator.label | replace("'", "''") }}'::varchar as label,
        '{{ indicator.category | replace("'", "''") }}'::varchar as category
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
)
select
    c.indicator_code,
    i.name,
    i.unit,
    c.label,
    c.category,
    c.indicator_code in ('SP.POP.TOTL', 'NY.GDP.MKTP.CD') as is_additive,
    i.source_note,
    i.source_organization,
    i.page_id as source_page_id
from configured c
left join {{ ref('stg_indicators') }} i using (indicator_code)