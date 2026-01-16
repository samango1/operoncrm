from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication

from .mixins import apply_search_filter
from .models import User
from .permissions import IsAdmin, IsAdminOrAgent, IsCreatorOrAdmin
from .serializers import (
    UserCreateSerializer,
    UserDeepSerializer,
    UserShallowSerializer,
    UserUpdateSerializer,
)


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsAdminOrAgent]
    lookup_field = "id"

    def _deep_requested(self) -> bool:
        return str(self.request.query_params.get("deep", "false")).lower() == "true"

    def get_permissions(self):
        if self.action == "retrieve":
            perms = [IsAuthenticated(), IsAdmin()]
        elif self.action in ("partial_update", "update", "destroy"):
            perms = [IsAuthenticated(), IsCreatorOrAdmin()]
        elif self.action == "me":
            perms = [IsAuthenticated()]
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

        if self._deep_requested():
            qs = qs.select_related("created_by")

        qs = apply_search_filter(qs, self.request, ngram_size=3, threshold=0.5)

        return qs

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

    def retrieve(self, request, *args, **kwargs):
        return super().retrieve(request, *args, **kwargs)

    @action(detail=False, methods=["get"], url_path="me")
    def me(self, request):
        user = request.user
        if not user or not user.is_authenticated:
            raise PermissionDenied("Authentication credentials were not provided.")

        if self._deep_requested():
            try:
                user = User.objects.select_related("created_by").get(id=user.id)
            except User.DoesNotExist:
                raise NotFound("User not found.")
            serializer = self.get_serializer(user)
        else:
            serializer = self.get_serializer(user)
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        return super().destroy(request, *args, **kwargs)
