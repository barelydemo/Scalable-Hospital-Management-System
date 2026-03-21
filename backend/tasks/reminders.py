"""Daily appointment reminder task."""
import json
import requests
from datetime import datetime

from extensions import celery, db, mail
from models import Appointment
from config import Config
from flask_mail import Message


@celery.task(name='tasks.reminders.daily_appointment_reminder')
def daily_appointment_reminder():
    """Check today's appointments and notify each patient."""
    today = datetime.utcnow().date()
    appointments = Appointment.query.filter_by(
        appointment_date=today, status='booked'
    ).all()

    for appt in appointments:
        patient_user = appt.patient.user
        doctor_user = appt.doctor.user
        body = (
            f"Hello {patient_user.username},\n\n"
            f"Reminder: You have an appointment today at {appt.appointment_time} "
            f"with Dr. {doctor_user.username} ({appt.doctor.specialization}).\n\n"
            f"Please be on time."
        )

        # Try email
        if Config.MAIL_USERNAME:
            try:
                msg = Message(
                    subject='Appointment Reminder',
                    recipients=[patient_user.email],
                    body=body,
                )
                mail.send(msg)
            except Exception as e:
                print(f'[reminder] email failed for {patient_user.email}: {e}')

        # Try Google Chat webhook
        if Config.GOOGLE_CHAT_WEBHOOK_URL:
            try:
                requests.post(
                    Config.GOOGLE_CHAT_WEBHOOK_URL,
                    json={'text': body},
                    timeout=10,
                )
            except Exception as e:
                print(f'[reminder] webhook failed: {e}')

    return f'Sent {len(appointments)} reminders for {today}'
