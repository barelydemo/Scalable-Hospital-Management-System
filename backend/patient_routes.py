import json
from datetime import datetime

from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity

from extensions import db, redis_client
from models import User, Patient, Doctor, Appointment, Department
from auth import role_required
from config import Config

patient_bp = Blueprint('patient', __name__)


# ── Profile update ───────────────────────────────────────────────────
@patient_bp.route('/profile', methods=['PUT'])
@role_required('patient')
def update_profile():
    patient = _current_patient()
    data = request.get_json(silent=True) or {}

    if 'phone' in data:
        patient.phone = data['phone']
    if 'address' in data:
        patient.address = data['address']
    if 'date_of_birth' in data and data['date_of_birth']:
        patient.date_of_birth = datetime.strptime(data['date_of_birth'], '%Y-%m-%d').date()
    if 'username' in data:
        patient.user.username = data['username']

    db.session.commit()
    return jsonify(patient.to_dict()), 200


# ── Search doctors by specialization ─────────────────────────────────
@patient_bp.route('/doctors', methods=['GET'])
@role_required('patient')
def search_doctors():
    spec = request.args.get('specialization', '').strip()
    cache_key = f'public:doctors:{spec}' if spec else 'public:doctors'
    cached = redis_client.get(cache_key)
    if cached:
        return jsonify(json.loads(cached)), 200

    query = Doctor.query.join(User).filter(User.is_active == True)
    if spec:
        query = query.filter(Doctor.specialization.ilike(f'%{spec}%'))
    doctors = query.all()
    data = [d.to_dict() for d in doctors]
    redis_client.setex(cache_key, Config.CACHE_TTL, json.dumps(data))
    return jsonify(data), 200


# ── specializations list ─────────────────────────────────────────────
@patient_bp.route('/specializations', methods=['GET'])
@role_required('patient')
def specializations():
    cached = redis_client.get('public:specializations')
    if cached:
        return jsonify(json.loads(cached)), 200
    rows = db.session.query(Doctor.specialization).distinct().all()
    data = sorted([r[0] for r in rows])
    redis_client.setex('public:specializations', Config.CACHE_TTL, json.dumps(data))
    return jsonify(data), 200


# ── Doctor availability ──────────────────────────────────────────────
@patient_bp.route('/doctors/<int:doctor_id>/availability', methods=['GET'])
@role_required('patient')
def doctor_availability(doctor_id):
    doctor = Doctor.query.get_or_404(doctor_id)
    return jsonify(
        doctor=doctor.to_dict(),
        availability=json.loads(doctor.availability_json or '{}'),
    ), 200


# ── Book appointment ─────────────────────────────────────────────────
@patient_bp.route('/appointments', methods=['POST'])
@role_required('patient')
def book_appointment():
    patient = _current_patient()
    data = request.get_json(silent=True) or {}
    doctor_id = data.get('doctor_id')
    date_str = data.get('appointment_date', '')
    time_str = data.get('appointment_time', '')

    if not doctor_id or not date_str or not time_str:
        return jsonify(msg='doctor_id, appointment_date and appointment_time required'), 400

    doctor = Doctor.query.get_or_404(doctor_id)

    # validate slot exists in availability
    avail = json.loads(doctor.availability_json or '{}')
    if date_str not in avail or time_str not in avail[date_str]:
        return jsonify(msg='Selected slot is not available'), 400

    # prevent duplicate booking
    existing = Appointment.query.filter_by(
        doctor_id=doctor_id,
        appointment_date=datetime.strptime(date_str, '%Y-%m-%d').date(),
        appointment_time=time_str,
    ).filter(Appointment.status != 'cancelled').first()
    if existing:
        return jsonify(msg='Slot already booked'), 409

    appt = Appointment(
        patient_id=patient.id,
        doctor_id=doctor_id,
        appointment_date=datetime.strptime(date_str, '%Y-%m-%d').date(),
        appointment_time=time_str,
        status='booked',
    )
    db.session.add(appt)
    db.session.commit()
    redis_client.delete('admin:appointments')
    return jsonify(appt.to_dict()), 201


# ── My appointments ──────────────────────────────────────────────────
@patient_bp.route('/appointments', methods=['GET'])
@role_required('patient')
def my_appointments():
    patient = _current_patient()
    appts = Appointment.query.filter_by(patient_id=patient.id)\
        .order_by(Appointment.appointment_date.desc()).all()
    return jsonify([a.to_dict() for a in appts]), 200


# ── Reschedule ───────────────────────────────────────────────────────
@patient_bp.route('/appointments/<int:appt_id>/reschedule', methods=['PUT'])
@role_required('patient')
def reschedule(appt_id):
    patient = _current_patient()
    appt = Appointment.query.get_or_404(appt_id)
    if appt.patient_id != patient.id:
        return jsonify(msg='Not your appointment'), 403
    if appt.status != 'booked':
        return jsonify(msg='Only booked appointments can be rescheduled'), 400

    data = request.get_json(silent=True) or {}
    date_str = data.get('appointment_date', '')
    time_str = data.get('appointment_time', '')
    if not date_str or not time_str:
        return jsonify(msg='New date and time required'), 400

    doctor = appt.doctor
    avail = json.loads(doctor.availability_json or '{}')
    if date_str not in avail or time_str not in avail[date_str]:
        return jsonify(msg='Selected slot is not available'), 400

    existing = Appointment.query.filter_by(
        doctor_id=doctor.id,
        appointment_date=datetime.strptime(date_str, '%Y-%m-%d').date(),
        appointment_time=time_str,
    ).filter(Appointment.status != 'cancelled', Appointment.id != appt.id).first()
    if existing:
        return jsonify(msg='Slot already booked'), 409

    appt.appointment_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    appt.appointment_time = time_str
    db.session.commit()
    redis_client.delete('admin:appointments')
    return jsonify(appt.to_dict()), 200


# ── Cancel ───────────────────────────────────────────────────────────
@patient_bp.route('/appointments/<int:appt_id>/cancel', methods=['PUT'])
@role_required('patient')
def cancel_appointment(appt_id):
    patient = _current_patient()
    appt = Appointment.query.get_or_404(appt_id)
    if appt.patient_id != patient.id:
        return jsonify(msg='Not your appointment'), 403
    if appt.status != 'booked':
        return jsonify(msg='Only booked appointments can be cancelled'), 400
    appt.status = 'cancelled'
    db.session.commit()
    redis_client.delete('admin:appointments')
    return jsonify(appt.to_dict()), 200


# ── Treatment history ────────────────────────────────────────────────
@patient_bp.route('/treatments', methods=['GET'])
@role_required('patient')
def treatment_history():
    patient = _current_patient()
    appts = Appointment.query.filter_by(patient_id=patient.id)\
        .order_by(Appointment.appointment_date.desc()).all()
    return jsonify([a.to_dict() for a in appts if a.treatment]), 200


# ── Export treatment CSV (async) ─────────────────────────────────────
@patient_bp.route('/treatments/export', methods=['POST'])
@role_required('patient')
def export_treatments():
    patient = _current_patient()
    from tasks.export_csv import export_treatment_csv
    task = export_treatment_csv.delay(patient.id)
    return jsonify(msg='Export started', task_id=task.id), 202


# ── Departments (patient-facing) ─────────────────────────────────────
@patient_bp.route('/departments', methods=['GET'])
@role_required('patient')
def list_departments():
    cached = redis_client.get('public:departments')
    if cached:
        import json as _json
        return jsonify(_json.loads(cached)), 200
    deps = Department.query.all()
    data = []
    for d in deps:
        active_doctors = [doc for doc in d.doctors if doc.user.is_active]
        entry = d.to_dict()
        entry['doctor_count'] = len(active_doctors)
        data.append(entry)
    import json as _json
    redis_client.setex('public:departments', Config.CACHE_TTL, _json.dumps(data))
    return jsonify(data), 200


@patient_bp.route('/departments/<int:dept_id>', methods=['GET'])
@role_required('patient')
def department_detail(dept_id):
    dept = Department.query.get_or_404(dept_id)
    active_doctors = [d for d in dept.doctors if d.user.is_active]
    return jsonify(
        department=dept.to_dict(),
        doctors=[d.to_dict() for d in active_doctors],
    ), 200


# ── helpers ──────────────────────────────────────────────────────────
def _current_patient():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    return user.patient
