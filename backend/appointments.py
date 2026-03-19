from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required

from models import Appointment

appointment_bp = Blueprint('appointments', __name__)


@appointment_bp.route('/<int:appt_id>', methods=['GET'])
@jwt_required()
def get_appointment(appt_id):
    appt = Appointment.query.get_or_404(appt_id)
    return jsonify(appt.to_dict()), 200
