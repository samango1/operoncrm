from .base import *

SECRET_KEY = "django-insecure-ny@wz96dq&w9uwzp_-g0@57!m98y&c@)r(qtwry*1%)0jz3y=z"
DEBUG = True
ALLOWED_HOSTS = []

CORS_ALLOWED_ORIGINS = [
    "http://localhost:3333",
    "http://login.operoncrm.d:3333",
    "http://admin.operoncrm.d:3333",
    "http://agent.operoncrm.d:3333",
]
CORS_ALLOWED_ORIGIN_REGEXES = [r"^http:\/\/(?:.*\.)?operoncrm\.d:3333$"]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}
