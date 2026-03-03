import uuid
from datetime import timedelta

from django.db import models
from django.utils import timezone

from .catalog import Product, Service
from .client import Client
from .company import Company
from .transaction import Transaction


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
