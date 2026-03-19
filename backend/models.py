from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

from extensions import db


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(20), nullable=False)          # admin | doctor | patient
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    doctor = db.relationship('Doctor', backref='user', uselist=False, cascade='all, delete-orphan')
    patient = db.relationship('Patient', backref='user', uselist=False, cascade='all, delete-orphan')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'role': self.role,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Department(db.Model):
    __tablename__ = 'departments'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    description = db.Column(db.Text)

    doctors = db.relationship('Doctor', backref='department', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
        }


class Doctor(db.Model):
    __tablename__ = 'doctors'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    specialization = db.Column(db.String(120), nullable=False)
    availability_json = db.Column(db.Text, default='{}')     # JSON: {date: [time_slots]}
    department_id = db.Column(db.Integer, db.ForeignKey('departments.id'))
    qualification = db.Column(db.String(100))
    experience_years = db.Column(db.Integer)
    bio = db.Column(db.Text)

    appointments = db.relationship('Appointment', backref='doctor', lazy=True)

    def to_dict(self):
        import json
        return {
            'id': self.id,
            'user_id': self.user_id,
            'username': self.user.username,
            'email': self.user.email,
            'specialization': self.specialization,
            'availability': json.loads(self.availability_json) if self.availability_json else {},
            'department_id': self.department_id,
            'department': self.department.name if self.department else None,
            'qualification': self.qualification,
            'experience_years': self.experience_years,
            'bio': self.bio,
            'is_active': self.user.is_active,
        }


class Patient(db.Model):
    __tablename__ = 'patients'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    phone = db.Column(db.String(20))
    address = db.Column(db.String(256))
    date_of_birth = db.Column(db.Date)

    appointments = db.relationship('Appointment', backref='patient', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'username': self.user.username,
            'email': self.user.email,
            'phone': self.phone,
            'address': self.address,
            'date_of_birth': self.date_of_birth.isoformat() if self.date_of_birth else None,
            'is_active': self.user.is_active,
        }


class Appointment(db.Model):
    __tablename__ = 'appointments'

    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('patients.id'), nullable=False)
    doctor_id = db.Column(db.Integer, db.ForeignKey('doctors.id'), nullable=False)
    appointment_date = db.Column(db.Date, nullable=False)
    appointment_time = db.Column(db.String(10), nullable=False)   # HH:MM
    status = db.Column(db.String(20), default='booked')           # booked | completed | cancelled
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    treatment = db.relationship('Treatment', backref='appointment', uselist=False, cascade='all, delete-orphan')

    __table_args__ = (
        db.UniqueConstraint('doctor_id', 'appointment_date', 'appointment_time',
                            name='uq_doctor_date_time'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'patient_id': self.patient_id,
            'patient_name': self.patient.user.username if self.patient else None,
            'doctor_id': self.doctor_id,
            'doctor_name': self.doctor.user.username if self.doctor else None,
            'doctor_specialization': self.doctor.specialization if self.doctor else None,
            'appointment_date': self.appointment_date.isoformat() if self.appointment_date else None,
            'appointment_time': self.appointment_time,
            'status': self.status,
            'treatment': self.treatment.to_dict() if self.treatment else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Treatment(db.Model):
    __tablename__ = 'treatments'

    id = db.Column(db.Integer, primary_key=True)
    appointment_id = db.Column(db.Integer, db.ForeignKey('appointments.id'), nullable=False)
    visit_type = db.Column(db.String(50))
    diagnosis = db.Column(db.Text, nullable=False)
    tests_done = db.Column(db.Text)
    prescription = db.Column(db.Text)
    medicines = db.Column(db.Text)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'appointment_id': self.appointment_id,
            'visit_type': self.visit_type,
            'diagnosis': self.diagnosis,
            'tests_done': self.tests_done,
            'prescription': self.prescription,
            'medicines': self.medicines,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
