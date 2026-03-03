from rest_framework import serializers

from ..models import Company, Product, Service
from .company import CompanyField, CompanySerializer
from .mixins import RepresentationMixin, is_deep_context


class ProductSerializer(RepresentationMixin, serializers.ModelSerializer):
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
        self._set_uuid_id(ret, instance)
        if not self._is_deep():
            return ret
        self._ensure_nested_data(
            ret,
            field_name="company",
            instance_obj=instance.company,
            serializer_cls=CompanySerializer,
        )
        return ret


class ServiceSerializer(RepresentationMixin, serializers.ModelSerializer):
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
        self._set_uuid_id(ret, instance)
        if not self._is_deep():
            return ret
        self._ensure_nested_data(
            ret,
            field_name="company",
            instance_obj=instance.company,
            serializer_cls=CompanySerializer,
        )
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
            service = value
        else:
            pk = getattr(value, "pk", value)
            try:
                service = Service.objects.get(pk=pk)
            except Service.DoesNotExist:
                return None

        if not is_deep_context(self.context):
            return {
                "id": str(service.id),
                "name": service.name,
                "price": str(service.price),
                "currency": service.currency,
            }

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


class ProductField(serializers.PrimaryKeyRelatedField):
    def to_representation(self, value):
        if value is None:
            return None

        if isinstance(value, Product):
            product = value
        else:
            pk = getattr(value, "pk", value)
            try:
                product = Product.objects.get(pk=pk)
            except Product.DoesNotExist:
                return None

        if not is_deep_context(self.context):
            return {
                "id": str(product.id),
                "name": product.name,
                "price": str(product.price),
                "currency": product.currency,
            }

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
