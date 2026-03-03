from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["platform_role"] = getattr(user, "platform_role", None)
        token["is_admin"] = getattr(user, "is_admin", False)
        token["is_agent"] = getattr(user, "is_agent", False)
        return token


class CustomTokenRefreshSerializer(TokenRefreshSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        refresh = RefreshToken(attrs["refresh"])
        user_id = refresh.get("user_id") or refresh.get("id")
        if user_id:
            User = get_user_model()
            try:
                user = User.objects.get(id=user_id)
            except (User.DoesNotExist, ValueError, TypeError) as exc:
                raise serializers.ValidationError("User not found for provided refresh token.") from exc
            access = refresh.access_token
            access["platform_role"] = getattr(user, "platform_role", None)
            access["is_admin"] = getattr(user, "is_admin", False)
            access["is_agent"] = getattr(user, "is_agent", False)
            data["access"] = str(access)
        return data
