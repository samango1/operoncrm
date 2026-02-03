import uuid
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import F
from django.utils import timezone
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


def validate_duration_minutes(value):
    if value == 0 or value < -1:
        raise ValidationError("duration_minutes must be -1 or a positive number of minutes.")


class CompanyMember(models.Model):
    id = models.BigAutoField(primary_key=True)
    company = models.ForeignKey(
        Company, on_delete=models.CASCADE, related_name="memberships"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="company_memberships"
    )
    telegram_id = models.IntegerField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("company", "user")
        indexes = [
            models.Index(fields=["company", "user"]),
            models.Index(fields=["user"]),
        ]

    def __str__(self):
        return f"{self.user_id} @ {self.company_id}"


class Client(models.Model):
    TYPE_INDIVIDUAL = "individual"
    TYPE_COMPANY = "company"
    TYPE_GROUP = "group"

    TYPE_CHOICES = [
        (TYPE_INDIVIDUAL, "Individual"),
        (TYPE_COMPANY, "Company"),
        (TYPE_GROUP, "Group"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default=TYPE_INDIVIDUAL)
    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=50, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    company = models.ForeignKey(
        Company,
        null=False,
        blank=False,
        on_delete=models.CASCADE,
        related_name="clients",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_clients",
    )
    valid = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({self.id})"

    def soft_delete(self):
        if self.valid:
            self.valid = False
            self.save(update_fields=["valid", "updated_at"])


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
        "Client",
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
        "Product",
        blank=True,
        related_name="transactions",
        through="TransactionProduct",
    )
    services = models.ManyToManyField(
        "Service",
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


class TransactionProduct(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    transaction = models.ForeignKey(
        Transaction,
        on_delete=models.CASCADE,
        related_name="product_items",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="transaction_items",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["transaction", "product"]),
        ]

    def __str__(self):
        return f"{self.transaction_id} -> {self.product_id}"


class TransactionService(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    transaction = models.ForeignKey(
        Transaction,
        on_delete=models.CASCADE,
        related_name="service_items",
    )
    service = models.ForeignKey(
        Service,
        on_delete=models.CASCADE,
        related_name="transaction_items",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["transaction", "service"]),
        ]

    def __str__(self):
        return f"{self.transaction_id} -> {self.service_id}"


class ClientServiceQuerySet(models.QuerySet):
    def expire_overdue(self, now=None):
        now = now or timezone.now()
        return self.filter(
            status=ClientService.STATUS_ACTIVE,
            ends_at__isnull=False,
            ends_at__lte=now,
        ).update(status=ClientService.STATUS_EXPIRED, updated_at=now)


class ClientService(models.Model):
    STATUS_ACTIVE = "active"
    STATUS_EXPIRED = "expired"
    STATUS_CHOICES = [
        (STATUS_ACTIVE, "Active"),
        (STATUS_EXPIRED, "Expired"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client = models.ForeignKey(
        Client,
        on_delete=models.CASCADE,
        related_name="services",
    )
    service = models.ForeignKey(
        Service,
        on_delete=models.CASCADE,
        related_name="client_services",
    )
    transaction = models.ForeignKey(
        Transaction,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="client_services",
    )
    company = models.ForeignKey(
        Company,
        null=False,
        blank=False,
        on_delete=models.CASCADE,
        related_name="client_services",
    )
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=STATUS_ACTIVE)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = ClientServiceQuerySet.as_manager()

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["client", "status"]),
            models.Index(fields=["client", "ends_at"]),
            models.Index(fields=["company", "status"]),
        ]

    def __str__(self):
        return f"{self.client_id} -> {self.service_id} ({self.status})"

    def save(self, *args, **kwargs):
        if self.client_id and not self.company_id:
            self.company_id = self.client.company_id
        super().save(*args, **kwargs)

    @staticmethod
    def build_ends_at(starts_at, duration_minutes):
        if duration_minutes == -1:
            return starts_at
        return starts_at + timedelta(minutes=duration_minutes)
