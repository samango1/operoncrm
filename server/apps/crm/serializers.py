from apps.users.models import User
from apps.users.serializers import UserShallowSerializer
from rest_framework import serializers

from .models import Company, Transaction


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

        if hasattr(value, "name"):
            return CompanySerializer(value, context=self.context).data

        pk = getattr(value, "pk", value)

        try:
            company = Company.objects.get(pk=pk)
        except Company.DoesNotExist:
            return None

        return CompanySerializer(company, context=self.context).data


class TransactionSerializer(serializers.ModelSerializer):
    client = UserShallowSerializer(read_only=True)
    client_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        write_only=True,
        source="client",
        allow_null=True,
        required=False,
    )

    company = CompanyField(queryset=Company.objects.all())

    discount = serializers.IntegerField(
        source="discount_amount", write_only=True, required=False, min_value=0
    )

    amount = serializers.IntegerField(read_only=True)

    invalid = serializers.BooleanField(read_only=True)

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
            "company",
            "client_id",
            "invalid",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "amount", "created_at", "updated_at", "discount_amount", "invalid"]

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret["id"] = str(instance.id)
        
        if instance.client:
            ret["client"]["id"] = str(instance.client.id)
        if instance.company:
            ret["company"]["id"] = str(instance.company.id)
        return ret

    def validate_initial_amount(self, value):
        if value is None:
            raise serializers.ValidationError("initial_amount is required.")
        if value < 0:
            raise serializers.ValidationError("initial_amount must be non-negative.")
        return value

    def validate(self, attrs):
        initial = attrs.get("initial_amount", getattr(self.instance, "initial_amount", None))
        discount = attrs.get("discount_amount", getattr(self.instance, "discount_amount", 0))

        if initial is None:
            raise serializers.ValidationError("initial_amount is required.")

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

        return attrs

    def create(self, validated_data):
        transaction = Transaction.objects.create(**validated_data)
        return transaction

    def update(self, instance, validated_data):
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.full_clean()
        instance.save()
        return instance