from apps.users.models import User
from apps.users.serializers import UserShallowSerializer
from rest_framework import serializers

from .models import Company


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
