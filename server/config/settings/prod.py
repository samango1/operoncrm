from env_loader import (
    DEBUG as ENV_DEBUG,
    POSTGRES_DB,
    POSTGRES_HOST,
    POSTGRES_PASSWORD,
    POSTGRES_PORT,
    POSTGRES_USER,
    SECRET_KEY as ENV_SECRET_KEY,
)

from .base import *

SECRET_KEY = ENV_SECRET_KEY
DEBUG = ENV_DEBUG
ALLOWED_HOSTS = ["*"]

CORS_ALLOWED_ORIGINS = [
    "https://operoncrm.uz",
    "https://login.operoncrm.uz",
    "https://admin.operoncrm.uz",
    "https://agent.operoncrm.uz",
]
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https:\/\/(?:.*\.)?operoncrm\.uz$",
]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": POSTGRES_DB,
        "USER": POSTGRES_USER,
        "PASSWORD": POSTGRES_PASSWORD,
        "HOST": POSTGRES_HOST,
        "PORT": POSTGRES_PORT,
    }
}
