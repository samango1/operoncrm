from django.db import transaction as db_transaction
from django.utils import timezone
from rest_framework import serializers

from ..models import ClientService, Product, Transaction, TransactionProduct, TransactionService


class TransactionWriteService:
    @classmethod
    def create(cls, *, validated_data, apply_stock_delta=False):
        data = dict(validated_data)
        categories = data.pop("categories", [])
        products = data.pop("products", [])
        services = data.pop("services", [])

        transaction_type = data.get("type")
        stock_delta = Transaction.stock_delta_for_type(transaction_type)

        with db_transaction.atomic():
            transaction = Transaction.objects.create(**data)
            if categories:
                transaction.categories.set(categories)
            if products:
                TransactionProduct.objects.bulk_create(
                    [TransactionProduct(transaction=transaction, product=product) for product in products]
                )
            if services:
                TransactionService.objects.bulk_create(
                    [TransactionService(transaction=transaction, service=service) for service in services]
                )
                cls._create_client_services(transaction, services)
            if apply_stock_delta and products and stock_delta:
                Product.adjust_stock(products, stock_delta)

        return transaction

    @classmethod
    def update(cls, *, instance, validated_data):
        data = dict(validated_data)
        categories = data.pop("categories", None)
        products = data.pop("products", None)
        services = data.pop("services", None)
        services_starts_at_provided = "services_starts_at" in data
        new_company = data.get("company", instance.company)
        new_client = data.get("client", instance.client)

        if instance.service_items.exists():
            if services is not None:
                raise serializers.ValidationError({"services": "Services cannot be modified after assignment."})
            if services_starts_at_provided and data.get("services_starts_at") != instance.services_starts_at:
                raise serializers.ValidationError({"services_starts_at": "services_starts_at cannot be modified after assignment."})
            if "client" in data and new_client and instance.client_id != new_client.id:
                raise serializers.ValidationError({"client": "Client cannot be changed after services are assigned."})

        if categories is None and new_company and new_company.id != instance.company_id:
            instance.categories.clear()
        if products is None and new_company and new_company.id != instance.company_id:
            instance.products.clear()

        for attr, val in data.items():
            setattr(instance, attr, val)
        instance.full_clean()
        instance.save()

        if categories is not None:
            instance.categories.set(categories)

        if products is not None:
            instance.product_items.all().delete()
            if products:
                TransactionProduct.objects.bulk_create(
                    [TransactionProduct(transaction=instance, product=product) for product in products]
                )

        if services is not None and services:
            TransactionService.objects.bulk_create(
                [TransactionService(transaction=instance, service=service) for service in services]
            )
            cls._create_client_services(instance, services)

        return instance

    @staticmethod
    def _create_client_services(transaction, services):
        if not services:
            return

        client = transaction.client
        starts_at = transaction.services_starts_at
        if not client or not starts_at:
            return

        now = timezone.now()
        items = []
        for service in services:
            duration = getattr(service, "duration_minutes", None)
            ends_at = ClientService.build_ends_at(starts_at, duration)
            status = ClientService.STATUS_ACTIVE
            if ends_at and ends_at <= now:
                status = ClientService.STATUS_EXPIRED
            items.append(
                ClientService(
                    client=client,
                    service=service,
                    transaction=transaction,
                    company=transaction.company,
                    starts_at=starts_at,
                    ends_at=ends_at,
                    status=status,
                )
            )

        ClientService.objects.bulk_create(items)
