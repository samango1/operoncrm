from apps.users.models import User
from apps.users.serializers import UserShallowSerializer
from django.utils import timezone
from rest_framework import serializers

from .models import (
    Company,
    Transaction,
    Client,
    TransactionCategory,
    Product,
    Service,
    TransactionProduct,
    TransactionService,
    ClientService,
)


class MemberSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    telegram_id = serializers.IntegerField(required=False, allow_null=True)

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        if ret.get("id") is not None:
            ret["id"] = str(ret["id"])
        return ret


class CompanySerializer(serializers.ModelSerializer):
    members = MemberSerializer(many=True)
    created_by = UserShallowSerializer(read_only=True)

    class Meta:
        model = Company
        fields = [
            "id",
            "name",
            "slug",
            "members",
            "plan",
            "created_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_by", "slug", "created_at", "updated_at"]

    def validate_members(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Members must be a list.")
        ids = [str(m.get("id")) for m in value if m.get("id") is not None]
        if not ids:
            return []
        users_count = User.objects.filter(id__in=ids).count()
        if users_count != len(ids):
            raise serializers.ValidationError(
                "One or more members refer to non-existent users."
            )
        return value

    def create(self, validated_data):
        members = validated_data.pop("members", [])
        normalized = []
        for m in members:
            normalized.append({"id": str(m["id"]), "telegram_id": m.get("telegram_id")})
        company = Company.objects.create(members=normalized, **validated_data)
        return company

    def update(self, instance, validated_data):
        members = validated_data.pop("members", None)
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        if members is not None:
            normalized = []
            for m in members:
                normalized.append(
                    {"id": str(m["id"]), "telegram_id": m.get("telegram_id")}
                )
            instance.members = normalized
        instance.save()
        return instance


class CompanyField(serializers.PrimaryKeyRelatedField):
    def to_representation(self, value):
        if value is None:
            return None

        if isinstance(value, Company):
            return CompanySerializer(value, context=self.context).data

        pk = getattr(value, "pk", value)

        try:
            company = Company.objects.get(pk=pk)
        except Company.DoesNotExist:
            return None

        return CompanySerializer(company, context=self.context).data

    def to_internal_value(self, data):
        if data is None:
            if self.allow_null:
                return None
            raise serializers.ValidationError("This field may not be null.")

        if isinstance(data, dict):
            pk = data.get("id") or data.get("pk")
            if not pk:
                raise serializers.ValidationError('Company object must include "id" field.')
            return super().to_internal_value(pk)

        return super().to_internal_value(data)


class ClientField(serializers.PrimaryKeyRelatedField):
    def to_representation(self, value):
        if value is None:
            return None

        if isinstance(value, Client):
            return ClientSerializer(value, context=self.context).data

        pk = getattr(value, "pk", value)

        try:
            client = Client.objects.get(pk=pk)
        except Client.DoesNotExist:
            return None

        return ClientSerializer(client, context=self.context).data

    def to_internal_value(self, data):
        if data is None:
            if self.allow_null:
                return None
            raise serializers.ValidationError("This field may not be null.")

        if isinstance(data, dict):
            pk = data.get("id") or data.get("pk")
            if not pk:
                raise serializers.ValidationError('Client object must include "id" field.')
            return super().to_internal_value(pk)

        return super().to_internal_value(data)


class ClientSerializer(serializers.ModelSerializer):
    company = CompanyField(queryset=Company.objects.all())
    created_by = UserShallowSerializer(read_only=True)

    class Meta:
        model = Client
        fields = [
            "id",
            "type",
            "name",
            "phone",
            "description",
            "company",
            "created_by",
            "valid",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_by", "created_at", "updated_at", "valid"]

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret["id"] = str(instance.id)
        if instance.company:
            company_data = ret.get("company")
            if not company_data:
                ret["company"] = CompanySerializer(instance.company, context=self.context).data
                company_data = ret["company"]
            company_data["id"] = str(instance.company.id)
        if instance.created_by:
            created_by = ret.get("created_by")
            if created_by:
                created_by["id"] = str(instance.created_by.id)
        return ret

    def create(self, validated_data):
        client = Client.objects.create(**validated_data)
        return client

    def update(self, instance, validated_data):
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.full_clean()
        instance.save()
        return instance


class TransactionCategorySerializer(serializers.ModelSerializer):
    company = CompanyField(queryset=Company.objects.all())
    created_by = UserShallowSerializer(read_only=True)

    class Meta:
        model = TransactionCategory
        fields = [
            "id",
            "name",
            "company",
            "created_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_by", "created_at", "updated_at"]

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret["id"] = str(instance.id)

        if instance.company:
            company_data = ret.get("company")
            if not company_data:
                ret["company"] = CompanySerializer(instance.company, context=self.context).data
                company_data = ret["company"]
            company_data["id"] = str(instance.company.id)

        if instance.created_by:
            created_by = ret.get("created_by")
            if created_by:
                created_by["id"] = str(instance.created_by.id)
        return ret


class ProductSerializer(serializers.ModelSerializer):
    company = CompanyField(queryset=Company.objects.all())

    class Meta:
        model = Product
        fields = [
            "id",
            "name",
            "description",
            "price",
            "currency",
            "active",
            "stock_quantity",
            "min_stock_level",
            "unit",
            "cost_price",
            "weight",
            "volume",
            "company",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret["id"] = str(instance.id)

        if instance.company:
            company_data = ret.get("company")
            if not company_data:
                ret["company"] = CompanySerializer(instance.company, context=self.context).data
                company_data = ret["company"]
            company_data["id"] = str(instance.company.id)
        return ret


class ServiceSerializer(serializers.ModelSerializer):
    company = CompanyField(queryset=Company.objects.all())

    class Meta:
        model = Service
        fields = [
            "id",
            "name",
            "description",
            "price",
            "currency",
            "active",
            "duration_minutes",
            "cost_price",
            "company",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret["id"] = str(instance.id)

        if instance.company:
            company_data = ret.get("company")
            if not company_data:
                ret["company"] = CompanySerializer(instance.company, context=self.context).data
                company_data = ret["company"]
            company_data["id"] = str(instance.company.id)
        return ret

    def validate_duration_minutes(self, value):
        if value == 0 or value < -1:
            raise serializers.ValidationError("duration_minutes must be -1 or a positive number of minutes.")
        return value


class ServiceField(serializers.PrimaryKeyRelatedField):
    def to_representation(self, value):
        if value is None:
            return None

        if isinstance(value, Service):
            return ServiceSerializer(value, context=self.context).data

        pk = getattr(value, "pk", value)

        try:
            service = Service.objects.get(pk=pk)
        except Service.DoesNotExist:
            return None

        return ServiceSerializer(service, context=self.context).data

    def to_internal_value(self, data):
        if data is None:
            if self.allow_null:
                return None
            raise serializers.ValidationError("This field may not be null.")

        if isinstance(data, dict):
            pk = data.get("id") or data.get("pk")
            if not pk:
                raise serializers.ValidationError('Service object must include "id" field.')
            return super().to_internal_value(pk)

        return super().to_internal_value(data)


class ClientServiceSerializer(serializers.ModelSerializer):
    client = ClientField(queryset=Client.objects.all())
    service = ServiceField(queryset=Service.objects.all())
    transaction = serializers.UUIDField(source="transaction_id", read_only=True)

    class Meta:
        model = ClientService
        fields = [
            "id",
            "client",
            "service",
            "transaction",
            "starts_at",
            "ends_at",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "transaction", "status", "created_at", "updated_at"]


class ProductField(serializers.PrimaryKeyRelatedField):
    def to_representation(self, value):
        if value is None:
            return None

        if isinstance(value, Product):
            return ProductSerializer(value, context=self.context).data

        pk = getattr(value, "pk", value)

        try:
            product = Product.objects.get(pk=pk)
        except Product.DoesNotExist:
            return None

        return ProductSerializer(product, context=self.context).data

    def to_internal_value(self, data):
        if data is None:
            if self.allow_null:
                return None
            raise serializers.ValidationError("This field may not be null.")

        if isinstance(data, dict):
            pk = data.get("id") or data.get("pk")
            if not pk:
                raise serializers.ValidationError('Product object must include "id" field.')
            return super().to_internal_value(pk)

        return super().to_internal_value(data)


class TransactionCategoryField(serializers.PrimaryKeyRelatedField):
    def to_representation(self, value):
        if value is None:
            return None

        if isinstance(value, TransactionCategory):
            return TransactionCategorySerializer(value, context=self.context).data

        pk = getattr(value, "pk", value)

        try:
            category = TransactionCategory.objects.get(pk=pk)
        except TransactionCategory.DoesNotExist:
            return None

        return TransactionCategorySerializer(category, context=self.context).data

    def to_internal_value(self, data):
        if data is None:
            if self.allow_null:
                return None
            raise serializers.ValidationError("This field may not be null.")

        if isinstance(data, dict):
            raise serializers.ValidationError("TransactionCategory must be provided as an id.")

        return super().to_internal_value(data)


class TransactionSerializer(serializers.ModelSerializer):
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

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret["id"] = str(instance.id)

        if instance.client:
            client_data = ret.get("client")
            if client_data is None:
                ret["client"] = ClientSerializer(instance.client, context=self.context).data
                ret["client"]["id"] = str(instance.client.id)
            else:
                client_data["id"] = str(instance.client.id)

        if instance.company:
            company_data = ret.get("company")
            if not company_data:
                ret["company"] = CompanySerializer(instance.company, context=self.context).data
                company_data = ret["company"]
            company_data["id"] = str(instance.company.id)

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

    def create(self, validated_data):
        categories = validated_data.pop("categories", [])
        products = validated_data.pop("products", [])
        services = validated_data.pop("services", [])
        transaction = Transaction.objects.create(**validated_data)
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
            self._create_client_services(transaction, services)
        return transaction

    def update(self, instance, validated_data):
        categories = validated_data.pop("categories", None)
        products = validated_data.pop("products", None)
        services = validated_data.pop("services", None)
        services_starts_at_provided = "services_starts_at" in validated_data
        new_company = validated_data.get("company", instance.company)
        new_client = validated_data.get("client", instance.client)

        if instance.service_items.exists():
            if services is not None:
                raise serializers.ValidationError({"services": "Services cannot be modified after assignment."})
            if services_starts_at_provided and validated_data.get("services_starts_at") != instance.services_starts_at:
                raise serializers.ValidationError({"services_starts_at": "services_starts_at cannot be modified after assignment."})
            if "client" in validated_data and new_client and instance.client_id != new_client.id:
                raise serializers.ValidationError({"client": "Client cannot be changed after services are assigned."})
        if categories is None and new_company and new_company.id != instance.company_id:
            instance.categories.clear()
        if products is None and new_company and new_company.id != instance.company_id:
            instance.products.clear()
        for attr, val in validated_data.items():
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
            self._create_client_services(instance, services)
        return instance

    def _create_client_services(self, transaction, services):
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
            if duration == -1 or (ends_at and ends_at <= now):
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


class CompanyStatisticsFiltersSerializer(serializers.Serializer):
    date_from = serializers.DateField(required=False, allow_null=True)
    date_to = serializers.DateField(required=False, allow_null=True)
    group_by = serializers.ChoiceField(choices=["day", "week", "month"])
    types = serializers.ListField(child=serializers.CharField(), required=False)
    methods = serializers.ListField(child=serializers.CharField(), required=False)
    currencies = serializers.ListField(child=serializers.CharField(), required=False)
    category_ids = serializers.ListField(child=serializers.CharField(), required=False)
    product_ids = serializers.ListField(child=serializers.CharField(), required=False)
    service_ids = serializers.ListField(child=serializers.CharField(), required=False)
    client_ids = serializers.ListField(child=serializers.CharField(), required=False)
    valid = serializers.BooleanField(required=False, allow_null=True)
    top = serializers.IntegerField(min_value=1, max_value=50)


class StatisticsKeyAmountItemSerializer(serializers.Serializer):
    key = serializers.CharField()
    label = serializers.CharField()
    count = serializers.IntegerField()
    amount = serializers.DecimalField(max_digits=18, decimal_places=2)


class StatisticsNamedAmountItemSerializer(serializers.Serializer):
    id = serializers.CharField()
    name = serializers.CharField()
    count = serializers.IntegerField()
    amount = serializers.DecimalField(max_digits=18, decimal_places=2)


class StatisticsNamedUnitsItemSerializer(serializers.Serializer):
    id = serializers.CharField()
    name = serializers.CharField()
    transactions_count = serializers.IntegerField()
    units = serializers.IntegerField()


class CompanyStatisticsSummarySerializer(serializers.Serializer):
    transactions_count = serializers.IntegerField()
    income_transactions_count = serializers.IntegerField()
    outcome_transactions_count = serializers.IntegerField()
    clients_with_transactions = serializers.IntegerField()
    products_units = serializers.IntegerField()
    services_units = serializers.IntegerField()
    income_total = serializers.DecimalField(max_digits=18, decimal_places=2)
    outcome_total = serializers.DecimalField(max_digits=18, decimal_places=2)
    total_amount = serializers.DecimalField(max_digits=18, decimal_places=2)
    discount_total = serializers.DecimalField(max_digits=18, decimal_places=2)
    balance = serializers.DecimalField(max_digits=18, decimal_places=2)
    average_transaction = serializers.DecimalField(max_digits=18, decimal_places=2)


class CompanyStatisticsTrendPointSerializer(serializers.Serializer):
    period = serializers.DateField()
    transactions_count = serializers.IntegerField()
    income = serializers.DecimalField(max_digits=18, decimal_places=2)
    outcome = serializers.DecimalField(max_digits=18, decimal_places=2)
    balance = serializers.DecimalField(max_digits=18, decimal_places=2)


class CompanyStatisticsBreakdownsSerializer(serializers.Serializer):
    types = StatisticsKeyAmountItemSerializer(many=True)
    methods = StatisticsKeyAmountItemSerializer(many=True)
    currencies = StatisticsKeyAmountItemSerializer(many=True)
    categories = StatisticsNamedAmountItemSerializer(many=True)
    clients = StatisticsNamedAmountItemSerializer(many=True)
    products = StatisticsNamedUnitsItemSerializer(many=True)
    services = StatisticsNamedUnitsItemSerializer(many=True)


class CompanyStatisticsSerializer(serializers.Serializer):
    filters = CompanyStatisticsFiltersSerializer()
    summary = CompanyStatisticsSummarySerializer()
    trend = CompanyStatisticsTrendPointSerializer(many=True)
    breakdowns = CompanyStatisticsBreakdownsSerializer()
