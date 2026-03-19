import json
from datetime import datetime, timedelta

from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity

from extensions import db, redis_client
from models import User, Doctor, Patient, Appointment, Treatment
from auth import role_required
from config import Config

doctor_bp = Blueprint('doctor', __name__)


# ── Dashboard ────────────────────────────────────────────────────────
@doctor_bp.route('/dashboard', methods=['GET'])
@role_required('doctor')
def dashboard():
    doctor = _current_doctor()
    today = datetime.utcnow().date()
    upcoming = Appointment.query.filter(
        Appointment.doctor_id == doctor.id,
        Appointment.appointment_date >= today,
        Appointment.status == 'booked',
    ).order_by(Appointment.appointment_date, Appointment.appointment_time).all()

    patients = {a.patient_id for a in Appointment.query.filter_by(doctor_id=doctor.id).all()}
    return jsonify(
        upcoming=[a.to_dict() for a in upcoming],
        patient_count=len(patients),
    ), 200


# ── Availability (next 7 days) ───────────────────────────────────────
@doctor_bp.route('/availability', methods=['GET'])
@role_required('doctor')
def get_availability():
    doctor = _current_doctor()
    return jsonify(availability=json.loads(doctor.availability_json or '{}')), 200


@doctor_bp.route('/availability', methods=['PUT'])
@role_required('doctor')
def set_availability():
    """
    Expects JSON: { "availability": { "2026-03-10": ["09:00","09:30",...], ... } }
    Only dates in the next 7 days are accepted.
    """
    doctor = _current_doctor()
    data = request.get_json(silent=True) or {}
    avail = data.get('availability', {})

    today = datetime.utcnow().date()
    week = {(today + timedelta(days=i)).isoformat() for i in range(7)}
    filtered = {k: v for k, v in avail.items() if k in week}

    doctor.availability_json = json.dumps(filtered)
    db.session.commit()
    redis_client.delete('public:doctors')
    return jsonify(msg='Availability updated', availability=filtered), 200


# ── Appointment history ──────────────────────────────────────────────
@doctor_bp.route('/appointments', methods=['GET'])
@role_required('doctor')
def appointment_history():
    doctor = _current_doctor()
    appts = Appointment.query.filter_by(doctor_id=doctor.id)\
        .order_by(Appointment.appointment_date.desc()).all()
    return jsonify([a.to_dict() for a in appts]), 200


# ── Mark appointment status ──────────────────────────────────────────
@doctor_bp.route('/appointments/<int:appt_id>/status', methods=['PUT'])
@role_required('doctor')
def mark_appointment(appt_id):
    doctor = _current_doctor()
    appt = Appointment.query.get_or_404(appt_id)
    if appt.doctor_id != doctor.id:
        return jsonify(msg='Not your appointment'), 403

    status = (request.get_json(silent=True) or {}).get('status', '')
    if status not in ('completed', 'cancelled'):
        return jsonify(msg='Status must be completed or cancelled'), 400
    appt.status = status
    db.session.commit()
    redis_client.delete('admin:appointments')
    return jsonify(appt.to_dict()), 200


# ── Add treatment ────────────────────────────────────────────────────
@doctor_bp.route('/appointments/<int:appt_id>/treatment', methods=['POST'])
@role_required('doctor')
def add_treatment(appt_id):
    doctor = _current_doctor()
    appt = Appointment.query.get_or_404(appt_id)
    if appt.doctor_id != doctor.id:
        return jsonify(msg='Not your appointment'), 403

    data = request.get_json(silent=True) or {}
    diagnosis = (data.get('diagnosis') or '').strip()
    if not diagnosis:
        return jsonify(msg='Diagnosis is required'), 400

    if appt.treatment:
        t = appt.treatment
        t.diagnosis = diagnosis
        t.visit_type = data.get('visit_type', t.visit_type)
        t.tests_done = data.get('tests_done', t.tests_done)
        t.prescription = data.get('prescription', t.prescription)
        t.medicines = data.get('medicines', t.medicines)
        t.notes = data.get('notes', t.notes)
    else:
        t = Treatment(
            appointment_id=appt.id,
            visit_type=data.get('visit_type', ''),
            diagnosis=diagnosis,
            tests_done=data.get('tests_done', ''),
            prescription=data.get('prescription', ''),
            medicines=data.get('medicines', ''),
            notes=data.get('notes', ''),
        )
        db.session.add(t)

    db.session.commit()
    return jsonify(t.to_dict()), 201


# ── Patients list ────────────────────────────────────────────────────
@doctor_bp.route('/patients', methods=['GET'])
@role_required('doctor')
def my_patients():
    doctor = _current_doctor()
    appts = Appointment.query.filter_by(doctor_id=doctor.id).all()
    seen = {}
    for a in appts:
        if a.patient_id not in seen:
            seen[a.patient_id] = a.patient.to_dict()
    return jsonify(list(seen.values())), 200


# ── Patient history (for doctor view) ────────────────────────────────
@doctor_bp.route('/patients/<int:patient_id>/history', methods=['GET'])
@role_required('doctor')
def patient_history(patient_id):
    patient = Patient.query.get_or_404(patient_id)
    appts = Appointment.query.filter_by(patient_id=patient_id)\
        .order_by(Appointment.appointment_date.desc()).all()
    history = [a.to_dict() for a in appts if a.treatment]
    return jsonify(patient=patient.to_dict(), history=history), 200


# ── helpers ──────────────────────────────────────────────────────────
def _current_doctor():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    return user.doctor
