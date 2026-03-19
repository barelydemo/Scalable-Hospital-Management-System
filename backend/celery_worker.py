"""
Celery worker entry point.

Run with:
    celery -A celery_worker.celery worker --loglevel=info
    celery -A celery_worker.celery beat   --loglevel=info   (for periodic tasks)
"""
from app import create_app
from extensions import celery          # noqa: F401 – expose celery to CLI

app = create_app()
app.app_context().push()
