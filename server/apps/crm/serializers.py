from apps.users.models import User
from apps.users.serializers import UserShallowSerializer
from rest_framework import serializers

from .models import Company, Transaction, Client, TransactionCategory, Product


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

    discount = serializers.DecimalField(
        source="discount_amount",
        write_only=True,
        required=False,
        min_value=0,
        max_digits=18,
        decimal_places=2,
    )

    amount = serializers.DecimalField(read_only=True, max_digits=18, decimal_places=2)

    valid = serializers.BooleanField(read_only=True)

    class Meta:
        model = Transaction
        fields = [
            "id",
            "initial_amount",
            "discount",
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
            "company",
            "valid",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "amount", "created_at", "updated_at", "discount_amount", "valid"]

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

        return attrs

    def create(self, validated_data):
        categories = validated_data.pop("categories", [])
        products = validated_data.pop("products", [])
        transaction = Transaction.objects.create(**validated_data)
        if categories:
            transaction.categories.set(categories)
        if products:
            transaction.products.set(products)
        return transaction

    def update(self, instance, validated_data):
        categories = validated_data.pop("categories", None)
        products = validated_data.pop("products", None)
        new_company = validated_data.get("company", instance.company)
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
            instance.products.set(products)
        return instance
