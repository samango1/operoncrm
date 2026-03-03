from rest_framework import serializers

from ..models import User


class UserShallowSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "name", "phone", "platform_role"]


class UserDeepSerializer(serializers.ModelSerializer):
    created_by = UserShallowSerializer(read_only=True)

    class Meta:
        model = User
        fields = ["id", "name", "phone", "platform_role", "created_by"]


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ["id", "name", "phone", "platform_role", "password", "created_by"]
        read_only_fields = ["id", "created_by"]

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        if password == "":
            password = None
        return User.objects.create_user(password=password, **validated_data)


class UserUpdateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ["name", "phone", "platform_role", "password"]
        extra_kwargs = {"phone": {"required": False}}

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        if password:
            instance.set_password(password)
        instance.save()
        return instance
