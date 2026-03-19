# Hospital Management System (HMS)

## Architecture

```
hospital-management-app/
├── .env                        # Environment variables
├── .env.example                # Template
├── requirements.txt            # Python dependencies
├── backend/
│   ├── app.py                  # Flask app factory + SPA entry (Jinja2)
│   ├── config.py               # Configuration from .env
│   ├── extensions.py           # SQLAlchemy, JWT, Mail, Redis, Celery
│   ├── models.py               # All SQLAlchemy models
│   ├── auth.py                 # Register / Login / Me + role_required
│   ├── admin_routes.py         # Admin CRUD + search + dashboard
│   ├── doctor_routes.py        # Doctor dashboard + availability + treatments
│   ├── patient_routes.py       # Patient booking + reschedule + profile
│   ├── appointments.py         # Shared appointment detail endpoint
│   ├── celery_worker.py        # Celery entry point
│   └── tasks/
│       ├── __init__.py
│       ├── reminders.py        # Daily appointment reminder
│       ├── monthly_reports.py  # Monthly doctor activity report
│       └── export_csv.py       # Async CSV export
└── frontend/
    └── static/
        └── js/
            └── app.js          # Complete Vue 3 SPA
```

---

## ER Diagram (textual)

```
┌──────────┐       ┌──────────┐       ┌───────────┐
│   User   │1────1 │  Doctor  │N────1 │ Department│
│──────────│       │──────────│       │───────────│
│ id  PK   │       │ id  PK   │       │ id  PK    │
│ username │       │ user_id FK│       │ name      │
│ email    │       │ specializ.│       │ descriptn │
│ password │       │ avail_json│       └───────────┘
│ role     │       │ dept_id FK│
│ is_active│       └──────────┘
│ created  │            │1
└──────────┘            │
      │1                │
      │          ┌──────────────┐
┌──────────┐     │  Appointment  │
│ Patient  │N──1 │──────────────│
│──────────│     │ id  PK       │
│ id  PK   │     │ patient_id FK│     ┌───────────┐
│ user_id FK│     │ doctor_id FK │1──1 │ Treatment │
│ phone    │     │ appt_date    │     │───────────│
│ address  │     │ appt_time    │     │ id  PK    │
│ dob      │     │ status       │     │ appt_id FK│
└──────────┘     └──────────────┘     │ diagnosis │
                  UNIQUE(doctor_id,    │ prescript │
                  appt_date, appt_time)│ notes     │
                                       └───────────┘
```

**Relationships:**

- User 1:1 Doctor (only when role=doctor)
- User 1:1 Patient (only when role=patient)
- Doctor N:1 Department
- Appointment N:1 Patient, N:1 Doctor
- Treatment 1:1 Appointment
- UNIQUE constraint on (doctor_id, appointment_date, appointment_time) prevents double-booking

---

## .env Values You Need

| Variable                  | Purpose                   | Example / Default          |
| ------------------------- | ------------------------- | -------------------------- |
| `SECRET_KEY`              | Flask secret for sessions | Any random long string     |
| `JWT_SECRET_KEY`          | Signing JWT tokens        | Any random long string     |
| `DATABASE_URL`            | SQLite path               | `sqlite:///hms.db`         |
| `REDIS_URL`               | Redis for caching         | `redis://localhost:6379/0` |
| `CELERY_BROKER_URL`       | Celery message broker     | `redis://localhost:6379/1` |
| `CELERY_RESULT_BACKEND`   | Celery result store       | `redis://localhost:6379/1` |
| `CACHE_TTL`               | Cache expiry (seconds)    | `300`                      |
| `ADMIN_USERNAME`          | Seed admin username       | `admin`                    |
| `ADMIN_EMAIL`             | Seed admin email          | `admin@hospital.com`       |
| `ADMIN_PASSWORD`          | Seed admin password       | `Admin@123`                |
| `MAIL_SERVER`             | SMTP host                 | `smtp.gmail.com`           |
| `MAIL_PORT`               | SMTP port                 | `587`                      |
| `MAIL_USE_TLS`            | TLS enabled               | `True`                     |
| `MAIL_USERNAME`           | SMTP login                | Your email                 |
| `MAIL_PASSWORD`           | SMTP app password         | Gmail app password         |
| `MAIL_DEFAULT_SENDER`     | From address              | Your email                 |
| `GOOGLE_CHAT_WEBHOOK_URL` | Chat webhook (optional)   | leave blank if unused      |
| `EXPORT_FOLDER`           | CSV export directory      | `exports`                  |

> **Note:** Email/webhook are only needed for Celery tasks. The app runs fine without them.

---

## Step-by-Step Commands to Run

### 1. Prerequisites

- **Python 3.10+** installed
- **Redis** running locally on port 6379
  - Windows: Download from https://github.com/tporadowski/redis/releases or use WSL
  - Start Redis: `redis-server`
- **Git** (optional)

### 2. Setup

```bash
# Navigate to the project
cd hospital-management-app

# Create virtual environment
python -m venv venv

# Activate it (Windows PowerShell)
.\venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt
```

### 3. Start Redis (separate terminal)

```bash
redis-server
```

### 4. Run Flask (separate terminal)

```bash
cd hospital-management-app
.\venv\Scripts\Activate.ps1
cd backend
python app.py
```

Flask will start at **http://localhost:5000**

The database (`hms.db`) is **auto-created** on first run.
The admin account is **auto-seeded** with credentials from `.env`.

### 5. Run Celery Worker (separate terminal)

```bash
cd hospital-management-app
.\venv\Scripts\Activate.ps1
cd backend
celery -A celery_worker.celery worker --loglevel=info --pool=solo
```

### 6. Run Celery Beat (separate terminal – for scheduled tasks)

```bash
cd hospital-management-app
.\venv\Scripts\Activate.ps1
cd backend
celery -A celery_worker.celery beat --loglevel=info
```

### 7. Open in Browser

Go to: **http://localhost:5000**

- Admin login: `admin@hospital.com` / `Admin@123`
- Register a new patient from the UI
- Admin can add doctors from the admin dashboard

---

## API Documentation

### Auth

| Method | Endpoint             | Body                                                            | Description          |
| ------ | -------------------- | --------------------------------------------------------------- | -------------------- |
| POST   | `/api/auth/register` | `{username, email, password, phone?, address?, date_of_birth?}` | Register patient     |
| POST   | `/api/auth/login`    | `{email, password}`                                             | Login (returns JWT)  |
| GET    | `/api/auth/me`       | —                                                               | Current user profile |

### Admin (requires admin JWT)

| Method | Endpoint                        | Description                                                              |
| ------ | ------------------------------- | ------------------------------------------------------------------------ |
| GET    | `/api/admin/dashboard`          | Stats                                                                    |
| GET    | `/api/admin/departments`        | List departments                                                         |
| GET    | `/api/admin/doctors`            | List all doctors                                                         |
| POST   | `/api/admin/doctors`            | Add doctor `{username, email, password, specialization, department_id?}` |
| PUT    | `/api/admin/doctors/:id`        | Update doctor                                                            |
| DELETE | `/api/admin/doctors/:id`        | Delete doctor                                                            |
| PUT    | `/api/admin/blacklist/:user_id` | Toggle active status                                                     |
| GET    | `/api/admin/doctors/search?q=`  | Search doctors                                                           |
| GET    | `/api/admin/patients`           | List patients                                                            |
| GET    | `/api/admin/patients/search?q=` | Search patients                                                          |
| GET    | `/api/admin/appointments`       | All appointments                                                         |

### Doctor (requires doctor JWT)

| Method | Endpoint                                 | Description                                        |
| ------ | ---------------------------------------- | -------------------------------------------------- | ------------- |
| GET    | `/api/doctor/dashboard`                  | Upcoming + patient count                           |
| GET    | `/api/doctor/availability`               | My availability                                    |
| PUT    | `/api/doctor/availability`               | Set availability `{availability: {date: [times]}}` |
| GET    | `/api/doctor/appointments`               | My appointment history                             |
| PUT    | `/api/doctor/appointments/:id/status`    | Mark `{status: "completed"                         | "cancelled"}` |
| POST   | `/api/doctor/appointments/:id/treatment` | Add treatment `{diagnosis, prescription?, notes?}` |
| GET    | `/api/doctor/patients`                   | My patients                                        |

### Patient (requires patient JWT)

| Method | Endpoint                                   | Description                                            |
| ------ | ------------------------------------------ | ------------------------------------------------------ |
| PUT    | `/api/patient/profile`                     | Update profile                                         |
| GET    | `/api/patient/doctors?specialization=`     | Search doctors                                         |
| GET    | `/api/patient/specializations`             | List specializations                                   |
| GET    | `/api/patient/doctors/:id/availability`    | Doctor availability                                    |
| POST   | `/api/patient/appointments`                | Book `{doctor_id, appointment_date, appointment_time}` |
| GET    | `/api/patient/appointments`                | My appointments                                        |
| PUT    | `/api/patient/appointments/:id/reschedule` | `{appointment_date, appointment_time}`                 |
| PUT    | `/api/patient/appointments/:id/cancel`     | Cancel                                                 |
| GET    | `/api/patient/treatments`                  | Treatment history                                      |
| POST   | `/api/patient/treatments/export`           | Async CSV export                                       |

---

## Example cURL Requests

### Login as Admin

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hospital.com","password":"Admin@123"}'
```

### Add a Doctor (as admin)

```bash
curl -X POST http://localhost:5000/api/admin/doctors \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -d '{"username":"dr_smith","email":"smith@hospital.com","password":"Doc@123","specialization":"Cardiology","department_id":2}'
```

### Register a Patient

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"john","email":"john@mail.com","password":"Pass@123","phone":"1234567890","address":"123 Main St","date_of_birth":"1990-05-15"}'
```

### Login as Doctor

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"smith@hospital.com","password":"Doc@123"}'
```

### Set Doctor Availability

```bash
curl -X PUT http://localhost:5000/api/doctor/availability \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <DOCTOR_TOKEN>" \
  -d '{"availability":{"2026-03-10":["09:00","09:30","10:00","10:30","11:00"]}}'
```

### Book Appointment (as patient)

```bash
curl -X POST http://localhost:5000/api/patient/appointments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <PATIENT_TOKEN>" \
  -d '{"doctor_id":1,"appointment_date":"2026-03-10","appointment_time":"09:00"}'
```

### Mark Appointment Complete (as doctor)

```bash
curl -X PUT http://localhost:5000/api/doctor/appointments/1/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <DOCTOR_TOKEN>" \
  -d '{"status":"completed"}'
```

### Add Treatment (as doctor)

```bash
curl -X POST http://localhost:5000/api/doctor/appointments/1/treatment \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <DOCTOR_TOKEN>" \
  -d '{"diagnosis":"Mild hypertension","prescription":"Amlodipine 5mg daily","notes":"Follow up in 2 weeks"}'
```

### Search Doctors (as admin)

```bash
curl http://localhost:5000/api/admin/doctors/search?q=cardiology \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

### Export Treatment CSV (as patient)

```bash
curl -X POST http://localhost:5000/api/patient/treatments/export \
  -H "Authorization: Bearer <PATIENT_TOKEN>"
```
