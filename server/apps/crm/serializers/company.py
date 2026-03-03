from apps.users.models import User
from apps.users.serializers import UserShallowSerializer
from rest_framework import serializers

from ..models import Company, CompanyMember
from .mixins import RepresentationMixin, is_deep_context


class MemberSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    telegram_id = serializers.IntegerField(required=False, allow_null=True)

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        if ret.get("id") is not None:
            ret["id"] = str(ret["id"])
        return ret


class CompanySerializer(RepresentationMixin, serializers.ModelSerializer):
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

    def get_fields(self):
        fields = super().get_fields()
        if self._is_read_request() and not self._is_deep():
            fields.pop("members", None)
        return fields

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
        company = Company.objects.create(**validated_data)
        self._sync_memberships(company, members)
        return company

    def update(self, instance, validated_data):
        members = validated_data.pop("members", None)
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()
        if members is not None:
            self._sync_memberships(instance, members)
        return instance

    @staticmethod
    def _sync_memberships(company, members):
        company.memberships.all().delete()
        if not members:
            return
        CompanyMember.objects.bulk_create(
            [
                CompanyMember(
                    company=company,
                    user_id=member["id"],
                    telegram_id=member.get("telegram_id"),
                )
                for member in members
            ],
            ignore_conflicts=True,
        )

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        self._set_uuid_id(ret, instance)

        if self._is_deep():
            return ret

        created_by = instance.created_by
        ret["created_by"] = (
            self._minimal_representation(created_by, fields=("id", "name", "platform_role"))
            if created_by
            else None
        )
        ret["members"] = []
        return ret


class CompanyField(serializers.PrimaryKeyRelatedField):
    def to_representation(self, value):
        if value is None:
            return None

        if isinstance(value, Company):
            company = value
        else:
            pk = getattr(value, "pk", value)
            try:
                company = Company.objects.get(pk=pk)
            except Company.DoesNotExist:
                return None

        if not is_deep_context(self.context):
            return {
                "id": str(company.id),
                "name": company.name,
                "slug": company.slug,
                "plan": company.plan,
            }

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
