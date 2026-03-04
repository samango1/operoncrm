from rest_framework import serializers

from ..models import PREFERENCE_LANG_CHOICES, User


class UserPreferencesSerializer(serializers.Serializer):
    lang = serializers.ChoiceField(
        choices=[choice[0] for choice in PREFERENCE_LANG_CHOICES],
        required=False,
        default="en",
    )


class UserShallowSerializer(serializers.ModelSerializer):
    preferences = UserPreferencesSerializer(read_only=True)

    class Meta:
        model = User
        fields = ["id", "name", "phone", "platform_role", "preferences"]


class UserDeepSerializer(serializers.ModelSerializer):
    created_by = UserShallowSerializer(read_only=True)
    preferences = UserPreferencesSerializer(read_only=True)

    class Meta:
        model = User
        fields = ["id", "name", "phone", "platform_role", "preferences", "created_by"]


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    preferences = UserPreferencesSerializer(required=False)

    class Meta:
        model = User
        fields = ["id", "name", "phone", "platform_role", "preferences", "password", "created_by"]
        read_only_fields = ["id", "created_by"]

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        if password == "":
            password = None
        return User.objects.create_user(password=password, **validated_data)


class UserUpdateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    preferences = UserPreferencesSerializer(required=False)

    class Meta:
        model = User
        fields = ["name", "phone", "platform_role", "preferences", "password"]
        extra_kwargs = {"phone": {"required": False}}

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        preferences = validated_data.pop("preferences", None)
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        if preferences is not None:
            current_preferences = instance.preferences if isinstance(instance.preferences, dict) else {}
            instance.preferences = {**current_preferences, **preferences}
        if password:
            instance.set_password(password)
        instance.save()
        return instance
