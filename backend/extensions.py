import redis
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_mail import Mail
from celery import Celery

from config import Config

db = SQLAlchemy()
jwt = JWTManager()
mail = Mail()

redis_client = redis.Redis.from_url(Config.REDIS_URL, decode_responses=True)

celery = Celery(__name__, broker=Config.CELERY_BROKER_URL, backend=Config.CELERY_RESULT_BACKEND)
