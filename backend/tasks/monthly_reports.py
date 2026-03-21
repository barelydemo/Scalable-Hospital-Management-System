"""Monthly doctor activity report task."""
from datetime import datetime, timedelta
from extensions import celery, db, mail
from models import Doctor, Appointment, Treatment
from config import Config
from flask_mail import Message


@celery.task(name='tasks.monthly_reports.monthly_doctor_report')
def monthly_doctor_report():
    """Generate & email an HTML activity report for each doctor."""
    today = datetime.utcnow().date()
    first_of_month = today.replace(day=1)
    last_month_end = first_of_month - timedelta(days=1)
    last_month_start = last_month_end.replace(day=1)

    doctors = Doctor.query.all()
    for doctor in doctors:
        appts = Appointment.query.filter(
            Appointment.doctor_id == doctor.id,
            Appointment.appointment_date >= last_month_start,
            Appointment.appointment_date <= last_month_end,
        ).all()

        completed = [a for a in appts if a.status == 'completed']
        treatments = [a.treatment for a in completed if a.treatment]

        html = _build_report_html(doctor, last_month_start, last_month_end,
                                  appts, completed, treatments)

        if Config.MAIL_USERNAME:
            try:
                msg = Message(
                    subject=f'Monthly Report – Dr. {doctor.user.username}',
                    recipients=[doctor.user.email],
                    html=html,
                )
                mail.send(msg)
            except Exception as e:
                print(f'[report] email failed for {doctor.user.email}: {e}')

    return f'Reports sent for {len(doctors)} doctors'


def _build_report_html(doctor, start, end, appts, completed, treatments):
    rows = ''
    for t in treatments:
        a = t.appointment
        rows += (
            f'<tr>'
            f'<td>{a.appointment_date}</td>'
            f'<td>{a.patient.user.username}</td>'
            f'<td>{t.diagnosis}</td>'
            f'<td>{t.prescription or "-"}</td>'
            f'<td>{t.notes or "-"}</td>'
            f'</tr>'
        )

    return f"""
    <html><body>
    <h2>Monthly Report – Dr. {doctor.user.username}</h2>
    <p>Period: {start} to {end}</p>
    <p>Total appointments: {len(appts)}</p>
    <p>Completed: {len(completed)}</p>
    <p>Treatments recorded: {len(treatments)}</p>
    <table border="1" cellpadding="5" cellspacing="0">
      <tr><th>Date</th><th>Patient</th><th>Diagnosis</th><th>Prescription</th><th>Notes</th></tr>
      {rows}
    </table>
    </body></html>
    """
