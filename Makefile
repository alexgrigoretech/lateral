PYTHON ?= python
ifeq ($(OS),Windows_NT)
VENV_PYTHON := .venv/Scripts/python.exe
else
VENV_PYTHON := .venv/bin/python
endif

.PHONY: setup run test export clean dbt-docs
setup:
	$(PYTHON) -m venv .venv
	$(VENV_PYTHON) -m pip install -r requirements.txt
run:
	$(VENV_PYTHON) -m wb_pipeline run
test:
	$(VENV_PYTHON) -m pytest -q
export:
	$(VENV_PYTHON) -m wb_pipeline export
dbt-docs:
	$(VENV_PYTHON) -m wb_pipeline transform --docs
clean:
	$(VENV_PYTHON) -c "import pathlib, shutil; root = pathlib.Path.cwd().resolve(); paths = [root / p for p in ('dbt/target', 'dbt/logs', '.pytest_cache')]; assert all(p.resolve().is_relative_to(root) for p in paths); [shutil.rmtree(p) for p in paths if p.exists()]"