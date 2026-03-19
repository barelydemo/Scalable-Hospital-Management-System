import os
from flask import Flask, send_from_directory, render_template_string
from config import Config
from extensions import db, jwt, mail, celery

ENTRY_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Hospital Management System</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
          rel="stylesheet" />
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css"
          rel="stylesheet" />
    <style>
        [v-cloak] { display: none; }
        body { background: #f0f2f5; }
    </style>
</head>
<body>
    <div id="app" v-cloak></div>

    <script src="https://cdn.jsdelivr.net/npm/vue@3.4.21/dist/vue.global.prod.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/vue-router@4.3.0/dist/vue-router.global.prod.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/axios@1.6.8/dist/axios.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
    <script src="/static/js/app.js"></script>
</body>
</html>
"""


def create_app():
    app = Flask(__name__, static_folder='../frontend/static')
    app.config.from_object(Config)

    # Init extensions
    db.init_app(app)
    jwt.init_app(app)
    mail.init_app(app)

    # Celery config
    celery.conf.update(
        broker_url=app.config['CELERY_BROKER_URL'],
        result_backend=app.config['CELERY_RESULT_BACKEND'],
        timezone='UTC',
        beat_schedule={
            'daily-reminder': {
                'task': 'tasks.reminders.daily_appointment_reminder',
                'schedule': 86400.0,   # every 24 h
            },
            'monthly-report': {
                'task': 'tasks.monthly_reports.monthly_doctor_report',
                'schedule': 2592000.0,  # ~30 days
            },
        },
    )

    class ContextTask(celery.Task):
        def __call__(self, *args, **kwargs):
            with app.app_context():
                return self.run(*args, **kwargs)
    celery.Task = ContextTask

    # Ensure export dir
    os.makedirs(app.config['EXPORT_FOLDER'], exist_ok=True)

    # Register blueprints
    from auth import auth_bp
    from admin_routes import admin_bp
    from doctor_routes import doctor_bp
    from patient_routes import patient_bp
    from appointments import appointment_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(doctor_bp, url_prefix='/api/doctor')
    app.register_blueprint(patient_bp, url_prefix='/api/patient')
    app.register_blueprint(appointment_bp, url_prefix='/api/appointments')

    # DB + seed
    with app.app_context():
        db.create_all()
        _add_missing_columns()
        _seed_admin(app)
        _seed_departments()

    # ---------- SPA entry point (Jinja2 template) ----------
    @app.route('/')
    @app.route('/<path:path>')
    def index(path=''):
        return render_template_string(ENTRY_TEMPLATE)

    return app


def _add_missing_columns():
    """Safely add new columns to existing SQLite tables (no-op if already present)."""
    from sqlalchemy import text
    new_cols = [
        ('doctors', 'qualification', 'VARCHAR(100)'),
        ('doctors', 'experience_years', 'INTEGER'),
        ('doctors', 'bio', 'TEXT'),
        ('treatments', 'visit_type', 'VARCHAR(50)'),
        ('treatments', 'tests_done', 'TEXT'),
        ('treatments', 'medicines', 'TEXT'),
    ]
    with db.engine.connect() as conn:
        for table, col, col_type in new_cols:
            try:
                conn.execute(text(f'ALTER TABLE {table} ADD COLUMN {col} {col_type}'))
                conn.commit()
            except Exception:
                pass  # column already exists


def _seed_admin(app):
    from models import User
    admin = User.query.filter_by(role='admin').first()
    if not admin:
        admin = User(
            username=app.config['ADMIN_USERNAME'],
            email=app.config['ADMIN_EMAIL'],
            role='admin',
        )
        admin.set_password(app.config['ADMIN_PASSWORD'])
        db.session.add(admin)
        db.session.commit()


def _seed_departments():
    from models import Department
    defaults = [
        ('General Medicine', 'General health care'),
        ('Cardiology', 'Heart and cardiovascular system'),
        ('Dermatology', 'Skin related treatments'),
        ('Neurology', 'Brain and nervous system'),
        ('Orthopedics', 'Bones, joints and muscles'),
        ('Pediatrics', 'Children health care'),
        ('Psychiatry', 'Mental health'),
        ('Radiology', 'Medical imaging'),
    ]
    for name, desc in defaults:
        if not Department.query.filter_by(name=name).first():
            db.session.add(Department(name=name, description=desc))
    db.session.commit()


if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, port=5000)
