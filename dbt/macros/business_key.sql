{% test business_key(model, columns) %}
select {{ columns | join(', ') }}, count(*) as records
from {{ model }}
group by {{ columns | join(', ') }}
having count(*) > 1
   or {% for column in columns %}{{ column }} is null{% if not loop.last %} or {% endif %}{% endfor %}
{% endtest %}