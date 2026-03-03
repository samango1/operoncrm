from apps.users.serializers import UserShallowSerializer
from rest_framework import serializers

from ..models import Client, Company
from .company import CompanyField, CompanySerializer
from .mixins import RepresentationMixin, is_deep_context


class ClientField(serializers.PrimaryKeyRelatedField):
    def to_representation(self, value):
        if value is None:
            return None

        if isinstance(value, Client):
            client = value
        else:
            pk = getattr(value, "pk", value)
            try:
                client = Client.objects.get(pk=pk)
            except Client.DoesNotExist:
                return None

        if not is_deep_context(self.context):
            return {
                "id": str(client.id),
                "name": client.name,
                "phone": client.phone,
                "type": client.type,
            }

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


class ClientSerializer(RepresentationMixin, serializers.ModelSerializer):
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
        self._set_uuid_id(ret, instance)

        if not self._is_deep():
            created_by = instance.created_by
            ret["created_by"] = (
                self._minimal_representation(created_by, fields=("id", "name", "platform_role"))
                if created_by
                else None
            )
            return ret

        self._ensure_nested_data(
            ret,
            field_name="company",
            instance_obj=instance.company,
            serializer_cls=CompanySerializer,
        )
        self._ensure_nested_data(
            ret,
            field_name="created_by",
            instance_obj=instance.created_by,
            serializer_cls=UserShallowSerializer,
        )
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
