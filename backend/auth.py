from functools import wraps
from datetime import datetime

from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token, jwt_required, get_jwt_identity, get_jwt
)

from extensions import db
from models import User, Patient

auth_bp = Blueprint('auth', __name__)


def role_required(*roles):
    """Decorator that enforces JWT auth + role membership."""
    def decorator(fn):
        @wraps(fn)
        @jwt_required()
        def wrapper(*args, **kwargs):
            claims = get_jwt()
            if claims.get('role') not in roles:
                return jsonify(msg='Access denied'), 403
            identity = get_jwt_identity()
            user = User.query.get(identity)
            if not user or not user.is_active:
                return jsonify(msg='Account deactivated'), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


# ── Register (patients only) ────────────────────────────────────────
@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json(silent=True) or {}
    username = (data.get('username') or '').strip()
    email    = (data.get('email') or '').strip()
    password = data.get('password', '')
    phone    = (data.get('phone') or '').strip()
    address  = (data.get('address') or '').strip()
    dob      = data.get('date_of_birth')

    if not username or not email or not password:
        return jsonify(msg='username, email and password are required'), 400

    if User.query.filter((User.username == username) | (User.email == email)).first():
        return jsonify(msg='Username or email already exists'), 409

    user = User(username=username, email=email, role='patient')
    user.set_password(password)
    db.session.add(user)
    db.session.flush()

    patient = Patient(
        user_id=user.id,
        phone=phone,
        address=address,
        date_of_birth=datetime.strptime(dob, '%Y-%m-%d').date() if dob else None,
    )
    db.session.add(patient)
    db.session.commit()

    token = create_access_token(
        identity=str(user.id),
        additional_claims={'role': user.role},
    )
    return jsonify(token=token, user=user.to_dict()), 201


# ── Login ────────────────────────────────────────────────────────────
@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip()
    password = data.get('password', '')

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify(msg='Invalid credentials'), 401
    if not user.is_active:
        return jsonify(msg='Account deactivated'), 403

    token = create_access_token(
        identity=str(user.id),
        additional_claims={'role': user.role},
    )
    return jsonify(token=token, user=user.to_dict()), 200


# ── Profile ──────────────────────────────────────────────────────────
@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def me():
    user = User.query.get(int(get_jwt_identity()))
    if not user:
        return jsonify(msg='User not found'), 404
    payload = user.to_dict()
    if user.role == 'doctor' and user.doctor:
        payload['doctor'] = user.doctor.to_dict()
    if user.role == 'patient' and user.patient:
        payload['patient'] = user.patient.to_dict()
    return jsonify(user=payload), 200
