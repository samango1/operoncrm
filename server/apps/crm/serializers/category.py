from apps.users.serializers import UserShallowSerializer
from rest_framework import serializers

from ..models import Company, TransactionCategory
from .company import CompanyField, CompanySerializer
from .mixins import RepresentationMixin, is_deep_context


class TransactionCategorySerializer(RepresentationMixin, serializers.ModelSerializer):
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


class TransactionCategoryField(serializers.PrimaryKeyRelatedField):
    def to_representation(self, value):
        if value is None:
            return None

        if isinstance(value, TransactionCategory):
            category = value
        else:
            pk = getattr(value, "pk", value)
            try:
                category = TransactionCategory.objects.get(pk=pk)
            except TransactionCategory.DoesNotExist:
                return None

        if not is_deep_context(self.context):
            return {
                "id": str(category.id),
                "name": category.name,
            }

        return TransactionCategorySerializer(category, context=self.context).data

    def to_internal_value(self, data):
        if data is None:
            if self.allow_null:
                return None
            raise serializers.ValidationError("This field may not be null.")

        if isinstance(data, dict):
            raise serializers.ValidationError("TransactionCategory must be provided as an id.")

        return super().to_internal_value(data)
