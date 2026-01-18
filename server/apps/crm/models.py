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
    members = models.JSONField(default=list, blank=True)
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


class Transaction(models.Model):
    TYPE_INCOME = "income"
    TYPE_OUTCOME = "outcome"
    TYPE_CHOICES = [
        (TYPE_INCOME, "Income"),
        (TYPE_OUTCOME, "Outcome"),
    ]

    METHOD_CASH = "cash"
    METHOD_CARD = "card"
    METHOD_CHOICES = [
        (METHOD_CASH, "Cash"),
        (METHOD_CARD, "Card"),
    ]

    CURRENCY_USD = "USD"
    CURRENCY_UZS = "UZS"
    CURRENCY_CHOICES = [
        (CURRENCY_USD, "USD"),
        (CURRENCY_UZS, "UZS"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    initial_amount = models.PositiveBigIntegerField()
    discount_amount = models.PositiveBigIntegerField(default=0)
    amount = models.PositiveBigIntegerField(editable=False)
    type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    method = models.CharField(max_length=10, choices=METHOD_CHOICES)
    date = models.DateTimeField()
    description = models.TextField(blank=True, null=True)
    currency = models.CharField(max_length=3, choices=CURRENCY_CHOICES)
    client = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="transactions",
    )
    company = models.ForeignKey(
        Company,
        null=False,
        blank=False,
        on_delete=models.CASCADE,
        related_name="transactions",
    )
    invalid = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "-created_at"]

    def clean(self):
        if self.discount_amount is None:
            self.discount_amount = 0
        if self.initial_amount < 0 or self.discount_amount < 0:
            raise ValueError("Amounts must be non-negative.")
        if self.discount_amount > self.initial_amount:
            raise ValueError("Discount cannot exceed initial amount.")

    def save(self, *args, **kwargs):
        if self.discount_amount is None:
            self.discount_amount = 0
        if self.discount_amount > self.initial_amount:
            raise ValueError("Discount cannot exceed initial amount.")
        self.amount = self.initial_amount - self.discount_amount
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Transaction {self.id} ({self.type}) — {self.amount} {self.currency}"