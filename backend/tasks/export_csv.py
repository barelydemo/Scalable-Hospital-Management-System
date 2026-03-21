"""User-triggered CSV export of treatment history."""
import csv
import os
from datetime import datetime

from extensions import celery, db, mail
from models import Patient, Appointment
from config import Config
from flask_mail import Message


@celery.task(name='tasks.export_csv.export_treatment_csv')
def export_treatment_csv(patient_id):
    patient = Patient.query.get(patient_id)
    if not patient:
        return 'Patient not found'

    appts = Appointment.query.filter_by(patient_id=patient.id)\
        .order_by(Appointment.appointment_date.desc()).all()

    filename = f'treatment_{patient.user.username}_{datetime.utcnow().strftime("%Y%m%d%H%M%S")}.csv'
    filepath = os.path.join(Config.EXPORT_FOLDER, filename)
    os.makedirs(Config.EXPORT_FOLDER, exist_ok=True)

    with open(filepath, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'user_id', 'username', 'doctor', 'appointment_date',
            'diagnosis', 'treatment', 'next_visit',
        ])
        for a in appts:
            t = a.treatment
            writer.writerow([
                patient.user.id,
                patient.user.username,
                a.doctor.user.username,
                a.appointment_date.isoformat(),
                t.diagnosis if t else '',
                t.prescription if t else '',
                '',   # next_visit – placeholder
            ])

    # Notify patient via email
    if Config.MAIL_USERNAME:
        try:
            msg = Message(
                subject='Your Treatment History Export is Ready',
                recipients=[patient.user.email],
                body=f'Hi {patient.user.username}, your CSV export is ready.',
            )
            with open(filepath, 'rb') as fp:
                msg.attach(filename, 'text/csv', fp.read())
            mail.send(msg)
        except Exception as e:
            print(f'[export] email failed: {e}')

    return filepath
