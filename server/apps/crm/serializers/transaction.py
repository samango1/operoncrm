from rest_framework import serializers

from ..models import (
    Client,
    Company,
    Product,
    Service,
    Transaction,
    TransactionCategory,
)
from .catalog import ProductField, ProductSerializer, ServiceField, ServiceSerializer
from .category import TransactionCategoryField
from .client import ClientField, ClientSerializer
from .company import CompanyField, CompanySerializer
from .mixins import RepresentationMixin


class TransactionSerializer(RepresentationMixin, serializers.ModelSerializer):
    client = ClientField(queryset=Client.objects.all(), allow_null=True, required=False)

    company = CompanyField(queryset=Company.objects.all())

    categories = TransactionCategoryField(
        queryset=TransactionCategory.objects.all(),
        many=True,
        required=False,
    )
    products = ProductField(
        queryset=Product.objects.all(),
        many=True,
        required=False,
    )
    services = ServiceField(
        queryset=Service.objects.all(),
        many=True,
        required=False,
    )

    amount = serializers.DecimalField(read_only=True, max_digits=18, decimal_places=2)

    valid = serializers.BooleanField(read_only=True)

    class Meta:
        model = Transaction
        fields = [
            "id",
            "initial_amount",
            "discount_amount",
            "amount",
            "type",
            "method",
            "date",
            "description",
            "currency",
            "client",
            "categories",
            "products",
            "services",
            "services_starts_at",
            "company",
            "valid",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "amount", "created_at", "updated_at", "valid"]

    def get_fields(self):
        fields = super().get_fields()
        if self._is_read_request() and not self._is_deep():
            fields.pop("categories", None)
            fields.pop("products", None)
            fields.pop("services", None)
        return fields

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        self._set_uuid_id(ret, instance)

        if not self._is_deep():
            return ret

        if instance.client:
            client_data = ret.get("client")
            if client_data is None:
                ret["client"] = ClientSerializer(instance.client, context=self.context).data
                ret["client"]["id"] = str(instance.client.id)
            else:
                client_data["id"] = str(instance.client.id)

        self._ensure_nested_data(
            ret,
            field_name="company",
            instance_obj=instance.company,
            serializer_cls=CompanySerializer,
        )

        if hasattr(instance, "product_items"):
            product_items = instance.product_items.select_related("product")
            ret["products"] = [
                ProductSerializer(item.product, context=self.context).data for item in product_items
            ]

        if hasattr(instance, "service_items"):
            service_items = instance.service_items.select_related("service")
            ret["services"] = [
                ServiceSerializer(item.service, context=self.context).data for item in service_items
            ]

        return ret

    def validate_initial_amount(self, value):
        if value is None:
            raise serializers.ValidationError("initial_amount is required.")
        if value <= 0:
            raise serializers.ValidationError("initial_amount must be greater than zero.")
        return value

    def validate(self, attrs):
        initial = attrs.get("initial_amount", getattr(self.instance, "initial_amount", None))
        discount = attrs.get("discount_amount", getattr(self.instance, "discount_amount", 0))
        company = attrs.get("company", getattr(self.instance, "company", None))
        categories = attrs.get("categories", None)
        products = attrs.get("products", None)
        services = attrs.get("services", None)
        services_starts_at = attrs.get(
            "services_starts_at",
            getattr(self.instance, "services_starts_at", None),
        )
        client = attrs.get("client", getattr(self.instance, "client", None))

        if initial is None:
            raise serializers.ValidationError("initial_amount is required.")
        if initial <= 0:
            raise serializers.ValidationError("initial_amount must be greater than zero.")

        if discount is None:
            discount = 0

        if discount < 0:
            raise serializers.ValidationError("discount must be non-negative.")
        if discount > initial:
            raise serializers.ValidationError("discount cannot exceed initial_amount.")

        method = attrs.get("method", getattr(self.instance, "method", None))
        date = attrs.get("date", getattr(self.instance, "date", None))
        currency = attrs.get("currency", getattr(self.instance, "currency", None))

        if method is None:
            raise serializers.ValidationError({"method": "method is required."})
        if date is None:
            raise serializers.ValidationError({"date": "date is required."})
        if currency is None:
            raise serializers.ValidationError({"currency": "currency is required."})

        if categories is not None and company is not None:
            mismatched = [cat for cat in categories if getattr(cat, "company_id", None) != company.id]
            if mismatched:
                raise serializers.ValidationError({"categories": "All categories must belong to the same company as the transaction."})

        if products is not None and company is not None:
            mismatched = [p for p in products if getattr(p, "company_id", None) != company.id]
            if mismatched:
                raise serializers.ValidationError({"products": "All products must belong to the same company as the transaction."})

        if services is not None and services:
            if services_starts_at is None:
                raise serializers.ValidationError({"services_starts_at": "services_starts_at is required when services are provided."})
            if client is None:
                raise serializers.ValidationError({"client": "client is required when services are provided."})
            if company is not None:
                mismatched = [s for s in services if getattr(s, "company_id", None) != company.id]
                if mismatched:
                    raise serializers.ValidationError({"services": "All services must belong to the same company as the transaction."})
                if client is not None and getattr(client, "company_id", None) != company.id:
                    raise serializers.ValidationError({"client": "Client must belong to the same company as the transaction."})

        return attrs
