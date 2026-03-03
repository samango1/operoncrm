import uuid
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import F

from .company import Company


def validate_duration_minutes(value):
    if value == 0 or value < -1:
        raise ValidationError("duration_minutes must be -1 or a positive number of minutes.")


class Product(models.Model):
    CURRENCY_USD = "USD"
    CURRENCY_UZS = "UZS"
    CURRENCY_CHOICES = [
        (CURRENCY_USD, "USD"),
        (CURRENCY_UZS, "UZS"),
    ]

    UNIT_KILOGRAM = "kilogram"
    UNIT_PIECE = "piece"
    UNIT_METER = "meter"
    UNIT_LITER = "liter"
    UNIT_CHOICES = [
        (UNIT_KILOGRAM, "Kilogram"),
        (UNIT_PIECE, "Piece"),
        (UNIT_METER, "Meter"),
        (UNIT_LITER, "Liter"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    description = models.TextField()
    price = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    currency = models.CharField(max_length=3, choices=CURRENCY_CHOICES)
    active = models.BooleanField(default=True)
    stock_quantity = models.IntegerField(validators=[MinValueValidator(-1)])
    min_stock_level = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    unit = models.CharField(max_length=10, choices=UNIT_CHOICES)
    company = models.ForeignKey(
        Company,
        null=False,
        blank=False,
        on_delete=models.CASCADE,
        related_name="products",
    )
    cost_price = models.DecimalField(
        null=True,
        blank=True,
        max_digits=18,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    weight = models.DecimalField(
        null=True,
        blank=True,
        max_digits=12,
        decimal_places=3,
        validators=[MinValueValidator(Decimal("0"))],
    )
    volume = models.DecimalField(
        null=True,
        blank=True,
        max_digits=12,
        decimal_places=3,
        validators=[MinValueValidator(Decimal("0"))],
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({self.id})"

    def soft_delete(self):
        if self.active:
            self.active = False
            self.save(update_fields=["active", "updated_at"])

    @classmethod
    def adjust_stock(cls, products, delta):
        if not products or not delta:
            return
        product_ids = [getattr(product, "id", product) for product in products]
        counts = {}
        for product_id in product_ids:
            counts[product_id] = counts.get(product_id, 0) + 1
        for product_id, count in counts.items():
            cls.objects.filter(id=product_id).exclude(stock_quantity=-1).update(
                stock_quantity=F("stock_quantity") + (delta * count)
            )


class Service(models.Model):
    CURRENCY_USD = "USD"
    CURRENCY_UZS = "UZS"
    CURRENCY_CHOICES = [
        (CURRENCY_USD, "USD"),
        (CURRENCY_UZS, "UZS"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    description = models.TextField()
    price = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    currency = models.CharField(max_length=3, choices=CURRENCY_CHOICES)
    active = models.BooleanField(default=True)
    duration_minutes = models.IntegerField(validators=[MinValueValidator(-1), validate_duration_minutes])
    company = models.ForeignKey(
        Company,
        null=False,
        blank=False,
        on_delete=models.CASCADE,
        related_name="services",
    )
    cost_price = models.DecimalField(
        null=True,
        blank=True,
        max_digits=18,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({self.id})"

    def soft_delete(self):
        if self.active:
            self.active = False
            self.save(update_fields=["active", "updated_at"])
