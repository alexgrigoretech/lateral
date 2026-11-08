FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN python -m pip install --no-cache-dir -r requirements.txt
COPY wb_pipeline wb_pipeline
COPY config config
COPY dbt dbt
CMD ["python", "-m", "wb_pipeline", "run"]