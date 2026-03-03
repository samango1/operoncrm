import uuid
from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from .company import Company


class TransactionCategory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    company = models.ForeignKey(
        Company,
        null=False,
        blank=False,
        on_delete=models.CASCADE,
        related_name="transaction_categories",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_transaction_categories",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({self.id})"


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
    initial_amount = models.DecimalField(
        max_digits=18, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))]
    )
    discount_amount = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0"),
        validators=[MinValueValidator(Decimal("0"))],
    )
    amount = models.DecimalField(max_digits=18, decimal_places=2, editable=False)
    type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    method = models.CharField(max_length=10, choices=METHOD_CHOICES)
    date = models.DateTimeField()
    description = models.TextField(blank=True, null=True)
    currency = models.CharField(max_length=3, choices=CURRENCY_CHOICES)
    client = models.ForeignKey(
        "crm.Client",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="transactions",
    )
    categories = models.ManyToManyField(
        TransactionCategory,
        blank=True,
        related_name="transactions",
    )
    products = models.ManyToManyField(
        "crm.Product",
        blank=True,
        related_name="transactions",
        through="TransactionProduct",
    )
    services = models.ManyToManyField(
        "crm.Service",
        blank=True,
        related_name="transactions",
        through="TransactionService",
    )
    services_starts_at = models.DateTimeField(null=True, blank=True)
    company = models.ForeignKey(
        Company,
        null=False,
        blank=False,
        on_delete=models.CASCADE,
        related_name="transactions",
    )
    valid = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "-created_at"]

    def clean(self):
        if self.discount_amount is None:
            self.discount_amount = Decimal("0")
        if self.initial_amount <= 0 or self.discount_amount < 0:
            raise ValueError("Amounts must be positive, discount must be non-negative.")
        if self.discount_amount > self.initial_amount:
            raise ValueError("Discount cannot exceed initial amount.")

    def save(self, *args, **kwargs):
        if self.discount_amount is None:
            self.discount_amount = Decimal("0")
        if self.initial_amount <= 0:
            raise ValueError("Initial amount must be greater than zero.")
        if self.discount_amount > self.initial_amount:
            raise ValueError("Discount cannot exceed initial amount.")
        self.amount = self.initial_amount - self.discount_amount
        super().save(*args, **kwargs)

    def soft_delete(self):
        if self.valid:
            self.valid = False
            self.save(update_fields=["valid", "updated_at"])

    def __str__(self):
        return f"Transaction {self.id} ({self.type}) — {self.amount} {self.currency}"

    @classmethod
    def stock_delta_for_type(cls, transaction_type):
        if transaction_type == cls.TYPE_INCOME:
            return -1
        if transaction_type == cls.TYPE_OUTCOME:
            return 1
        return 0
