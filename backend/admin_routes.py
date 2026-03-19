import json

from flask import Blueprint, request, jsonify
from extensions import db, redis_client
from models import User, Doctor, Patient, Appointment, Department
from auth import role_required
from config import Config

admin_bp = Blueprint('admin', __name__)


# ── Dashboard ────────────────────────────────────────────────────────
@admin_bp.route('/dashboard', methods=['GET'])
@role_required('admin')
def dashboard():
    return jsonify(
        total_doctors=Doctor.query.count(),
        total_patients=Patient.query.count(),
        total_appointments=Appointment.query.count(),
    ), 200


# ── Departments ──────────────────────────────────────────────────────
@admin_bp.route('/departments', methods=['GET'])
@role_required('admin')
def list_departments():
    deps = Department.query.all()
    return jsonify([d.to_dict() for d in deps]), 200


# ── Doctor CRUD ──────────────────────────────────────────────────────
@admin_bp.route('/doctors', methods=['GET'])
@role_required('admin')
def list_doctors():
    cached = redis_client.get('admin:doctors')
    if cached:
        return jsonify(json.loads(cached)), 200
    doctors = Doctor.query.all()
    data = [d.to_dict() for d in doctors]
    redis_client.setex('admin:doctors', Config.CACHE_TTL, json.dumps(data))
    return jsonify(data), 200


@admin_bp.route('/doctors', methods=['POST'])
@role_required('admin')
def add_doctor():
    data = request.get_json(silent=True) or {}
    username = (data.get('username') or '').strip()
    email = (data.get('email') or '').strip()
    password = data.get('password', '')
    specialization = (data.get('specialization') or '').strip()
    department_id = data.get('department_id')

    if not username or not email or not password or not specialization:
        return jsonify(msg='All fields required'), 400

    if User.query.filter((User.username == username) | (User.email == email)).first():
        return jsonify(msg='Username or email already exists'), 409

    user = User(username=username, email=email, role='doctor')
    user.set_password(password)
    db.session.add(user)
    db.session.flush()

    doctor = Doctor(
        user_id=user.id,
        specialization=specialization,
        department_id=department_id,
        qualification=(data.get('qualification') or '').strip() or None,
        experience_years=data.get('experience_years') or None,
        bio=(data.get('bio') or '').strip() or None,
    )
    db.session.add(doctor)
    db.session.commit()
    _invalidate_doctor_cache()
    return jsonify(doctor.to_dict()), 201


@admin_bp.route('/doctors/<int:doctor_id>', methods=['PUT'])
@role_required('admin')
def update_doctor(doctor_id):
    doctor = Doctor.query.get_or_404(doctor_id)
    data = request.get_json(silent=True) or {}

    if 'specialization' in data:
        doctor.specialization = data['specialization']
    if 'department_id' in data:
        doctor.department_id = data['department_id']
    if 'username' in data:
        doctor.user.username = data['username']
    if 'email' in data:
        doctor.user.email = data['email']
    if 'qualification' in data:
        doctor.qualification = data['qualification']
    if 'experience_years' in data:
        doctor.experience_years = data['experience_years']
    if 'bio' in data:
        doctor.bio = data['bio']

    db.session.commit()
    _invalidate_doctor_cache()
    return jsonify(doctor.to_dict()), 200


@admin_bp.route('/doctors/<int:doctor_id>', methods=['DELETE'])
@role_required('admin')
def delete_doctor(doctor_id):
    doctor = Doctor.query.get_or_404(doctor_id)
    user = doctor.user
    db.session.delete(user)          # cascade deletes doctor
    db.session.commit()
    _invalidate_doctor_cache()
    return jsonify(msg='Doctor deleted'), 200


# ── Blacklist doctor / patient (deactivate) ──────────────────────────
@admin_bp.route('/blacklist/<int:user_id>', methods=['PUT'])
@role_required('admin')
def blacklist_user(user_id):
    user = User.query.get_or_404(user_id)
    user.is_active = not user.is_active
    db.session.commit()
    _invalidate_doctor_cache()
    return jsonify(msg=f"User {'activated' if user.is_active else 'deactivated'}",
                   user=user.to_dict()), 200


# ── Search doctors ───────────────────────────────────────────────────
@admin_bp.route('/doctors/search', methods=['GET'])
@role_required('admin')
def search_doctors():
    q = (request.args.get('q') or '').strip()
    if not q:
        return jsonify([]), 200
    results = Doctor.query.join(User).filter(
        (User.username.ilike(f'%{q}%')) | (Doctor.specialization.ilike(f'%{q}%'))
    ).all()
    return jsonify([d.to_dict() for d in results]), 200


# ── Search patients ──────────────────────────────────────────────────
@admin_bp.route('/patients/search', methods=['GET'])
@role_required('admin')
def search_patients():
    q = (request.args.get('q') or '').strip()
    if not q:
        return jsonify([]), 200
    results = Patient.query.join(User).filter(
        (User.username.ilike(f'%{q}%')) | (Patient.id == int(q) if q.isdigit() else False)
    ).all()
    return jsonify([p.to_dict() for p in results]), 200


# ── Patients list ────────────────────────────────────────────────────
@admin_bp.route('/patients', methods=['GET'])
@role_required('admin')
def list_patients():
    patients = Patient.query.all()
    return jsonify([p.to_dict() for p in patients]), 200


# ── Appointments ─────────────────────────────────────────────────────
@admin_bp.route('/appointments', methods=['GET'])
@role_required('admin')
def list_appointments():
    cached = redis_client.get('admin:appointments')
    if cached:
        return jsonify(json.loads(cached)), 200
    appointments = Appointment.query.order_by(Appointment.appointment_date.desc()).all()
    data = [a.to_dict() for a in appointments]
    redis_client.setex('admin:appointments', Config.CACHE_TTL, json.dumps(data))
    return jsonify(data), 200


# ── Patient history (for admin view) ────────────────────────────────
@admin_bp.route('/patients/<int:patient_id>/history', methods=['GET'])
@role_required('admin')
def patient_history(patient_id):
    patient = Patient.query.get_or_404(patient_id)
    appts = Appointment.query.filter_by(patient_id=patient_id)\
        .order_by(Appointment.appointment_date.desc()).all()
    history = [a.to_dict() for a in appts if a.treatment]
    return jsonify(patient=patient.to_dict(), history=history), 200


# ── helpers ──────────────────────────────────────────────────────────
def _invalidate_doctor_cache():
    redis_client.delete('admin:doctors')
    redis_client.delete('public:doctors')
    redis_client.delete('public:specializations')
