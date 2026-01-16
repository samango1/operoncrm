import uuid

from django.conf import settings
from django.db import models
from django.utils.text import slugify


class Company(models.Model):
    PLAN_START = "start"
    PLAN_BASIC = "basic"
    PLAN_ADVANCED = "advanced"

    PLAN_CHOICES = [
        (PLAN_START, "Start"),
        (PLAN_BASIC, "Basic"),
        (PLAN_ADVANCED, "Advanced"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    members = models.JSONField(
        default=list, blank=True
    )  # list of {"id": "<uuid>", "telegram_id": <bigint?>}
    plan = models.CharField(max_length=10, choices=PLAN_CHOICES, default=PLAN_START)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_companies",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({self.id})"

    def _generate_unique_slug(self):
        base = slugify(self.name)[:200] or str(self.id)[:8]
        slug_candidate = base
        idx = 1
        while Company.objects.filter(slug=slug_candidate).exclude(pk=self.pk).exists():
            slug_candidate = f"{base}-{idx}"
            idx += 1
        return slug_candidate

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = self._generate_unique_slug()
        normalized_members = []
        for m in self.members or []:
            if isinstance(m, dict):
                member_id = m.get("id")
                telegram_id = m.get("telegram_id", None)
                if member_id is not None:
                    member_id = str(member_id)
                normalized_members.append({"id": member_id, "telegram_id": telegram_id})
            else:
                continue
        self.members = normalized_members
        super().save(*args, **kwargs)
