from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema
from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication

from ..mixins import DeepQueryMixin, apply_search_filter
from ..models import User
from ..permissions import IsAdmin, IsAdminOrAgent, IsCreatorOrAdmin
from ..serializers import (
    UserCreateSerializer,
    UserDeepSerializer,
    UserShallowSerializer,
    UserUpdateSerializer,
)


class UserViewSet(DeepQueryMixin, viewsets.ModelViewSet):
    queryset = User.objects.all()
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsAdminOrAgent]
    lookup_field = "id"

    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="search",
                location=OpenApiParameter.QUERY,
                required=False,
                type=OpenApiTypes.STR,
                description="Fuzzy search query.",
            ),
            OpenApiParameter(
                name="deep",
                location=OpenApiParameter.QUERY,
                required=False,
                type=OpenApiTypes.BOOL,
                description="Include expanded nested objects. Default: false for list.",
            ),
        ]
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="deep",
                location=OpenApiParameter.QUERY,
                required=False,
                type=OpenApiTypes.BOOL,
                description="Include expanded nested objects. Default: true for detail.",
            ),
        ]
    )
    def retrieve(self, request, *args, **kwargs):
        return super().retrieve(request, *args, **kwargs)

    def get_permissions(self):
        if self.action == "retrieve":
            perms = [IsAuthenticated(), IsAdmin()]
        elif self.action in ("partial_update", "update", "destroy"):
            perms = [IsAuthenticated(), IsCreatorOrAdmin()]
        else:
            perms = [IsAuthenticated(), IsAdminOrAgent()]
        return perms

    def get_serializer_class(self):
        if self.action in ("create",):
            return UserCreateSerializer
        if self.action in ("partial_update", "update"):
            return UserUpdateSerializer
        if self._deep_requested():
            return UserDeepSerializer
        return UserShallowSerializer

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return User.objects.none()

        if getattr(user, "is_admin", False):
            qs = User.objects.all()
        elif getattr(user, "is_agent", False):
            qs = User.objects.filter(created_by=user)
        else:
            return User.objects.none()

        qs = qs.order_by("name", "id")

        if self._deep_requested():
            qs = qs.select_related("created_by")

        qs = apply_search_filter(qs, self.request, ngram_size=3, threshold=0.5)

        return qs

    def get_object(self):
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        obj_id = self.kwargs.get(lookup_url_kwarg)
        instance = get_object_or_404(User.objects.select_related("created_by"), pk=obj_id)
        self.check_object_permissions(self.request, instance)
        return instance

    def perform_create(self, serializer):
        actor = self.request.user
        if not (getattr(actor, "is_admin", False) or getattr(actor, "is_agent", False)):
            raise PermissionDenied("Only admins and agents can create users.")

        requested_role = serializer.validated_data.get("platform_role", "member")
        if getattr(actor, "is_agent", False) and requested_role in ("admin", "agent"):
            raise PermissionDenied("Agents can only create members.")

        serializer.save(created_by=actor)

    def perform_update(self, serializer):
        actor = self.request.user
        if getattr(actor, "is_agent", False):
            new_role = None
            new_role = serializer.validated_data.get("platform_role")
            if new_role and new_role in ("admin", "agent"):
                raise PermissionDenied("Agents cannot set admin/agent roles.")
        serializer.save()
