from apps.users.mixins import apply_search_filter
from apps.users.permissions import IsAdmin, IsAdminOrAgent, IsCreatorOrAdmin
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication

from .models import Company
from .serializers import CompanySerializer


class CompanyViewSet(viewsets.ModelViewSet):
    queryset = Company.objects.all()
    serializer_class = CompanySerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsAdminOrAgent]
    lookup_field = "id"

    def get_permissions(self):
        if self.action == "retrieve":
            perms = [IsAuthenticated(), IsCreatorOrAdmin()]
        elif self.action in ("partial_update", "update"):
            perms = [IsAuthenticated(), IsCreatorOrAdmin()]
        elif self.action == "destroy":
            perms = [IsAuthenticated(), IsAdmin()]
        elif self.action == "me":
            perms = [IsAuthenticated()]
        elif self.action == "list":
            perms = [IsAuthenticated(), IsAdminOrAgent()]
        elif self.action == "create":
            perms = [IsAuthenticated(), IsAdminOrAgent()]
        else:
            perms = [IsAuthenticated()]
        return perms

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Company.objects.none()

        if getattr(user, "is_admin", False):
            qs = Company.objects.all().select_related("created_by")
        elif getattr(user, "is_agent", False):
            qs = Company.objects.filter(created_by=user).select_related("created_by")
        else:
            qs = Company.objects.none()

        qs = apply_search_filter(qs, self.request, ngram_size=3, threshold=0.5)

        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=["get"], url_path="me")
    def me(self, request):
        user = request.user
        if not user or not user.is_authenticated:
            raise PermissionDenied("Authentication credentials were not provided.")

        qs = Company.objects.all()
        user_id_str = str(user.id)
        matching = []
        for company in qs:
            members = company.members or []
            for m in members:
                if str(m.get("id")) == user_id_str:
                    matching.append(company)
                    break

        page = self.paginate_queryset(matching)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(matching, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def retrieve(self, request, *args, **kwargs):
        return super().retrieve(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        return super().destroy(request, *args, **kwargs)
