import uuid

from django.contrib.auth.models import (
    AbstractBaseUser,
    BaseUserManager,
    PermissionsMixin,
)
from django.db import models

PLATFORM_ROLES = [
    ("admin", "Admin"),
    ("agent", "Agent"),
    ("member", "Member"),
]

PREFERENCE_LANG_CHOICES = [
    ("en", "English"),
    ("ru", "Russian"),
]


def default_user_preferences():
    return {"lang": "en"}


class UserManager(BaseUserManager):
    def create_user(self, phone, password=None, **extra_fields):
        if not phone:
            raise ValueError("The phone number must be set")
        user = self.model(phone=phone, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, phone, password=None, **extra_fields):
        extra_fields.setdefault("platform_role", "admin")
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self.create_user(phone, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    phone = models.BigIntegerField(unique=True)
    platform_role = models.CharField(
        max_length=10, choices=PLATFORM_ROLES, default="member"
    )
    preferences = models.JSONField(default=default_user_preferences, blank=True)

    created_by = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_users",
    )

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    objects = UserManager()

    USERNAME_FIELD = "phone"
    REQUIRED_FIELDS = ["name"]

    @property
    def is_admin(self) -> bool:
        return self.platform_role == "admin"

    @property
    def is_agent(self) -> bool:
        return self.platform_role == "agent"

    @property
    def is_member(self) -> bool:
        return self.platform_role == "member"

    def __str__(self):
        return f"{self.name} ({self.phone})"
