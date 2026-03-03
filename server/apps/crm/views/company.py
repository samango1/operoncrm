from django.shortcuts import get_object_or_404
from apps.users.mixins import DeepQueryMixin, apply_search_filter
from apps.users.permissions import IsAdmin, IsAdminOrAgent, IsCreatorOrAdmin, IsMemberOrCreatedBy
from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication

from ..models import Company
from ..serializers import CompanySerializer
from .common import CompanyAccessMixinLocal
from .company_related import CompanyRelatedActionsMixin
from .company_statistics import CompanyStatisticsMixin


class CompanyViewSet(
    CompanyStatisticsMixin,
    CompanyRelatedActionsMixin,
    DeepQueryMixin,
    CompanyAccessMixinLocal,
    viewsets.ModelViewSet,
):
    queryset = Company.objects.all()
    serializer_class = CompanySerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsAdminOrAgent]
    lookup_field = "id"
    deep_shallow_get_actions = (
        "transactions",
        "clients",
        "products",
        "services",
        "transaction_categories",
    )

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
            perms = [IsAuthenticated(), IsMemberOrCreatedBy()]
        elif self.action in (
            "transactions",
            "transaction_detail",
            "clients",
            "client_detail",
            "products",
            "product_detail",
            "services",
            "service_detail",
            "statistics",
        ):
            perms = [IsAuthenticated(), IsMemberOrCreatedBy()]
        elif self.action in ("partial_update", "update"):
            perms = [IsAuthenticated(), IsCreatorOrAdmin()]
        elif self.action == "destroy":
            perms = [IsAuthenticated(), IsAdmin()]
        elif self.action == "slug_to_id":
            perms = [IsAuthenticated()]
        elif self.action == "list":
            perms = [IsAuthenticated()]
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
            qs = self._user_companies_qs(user).select_related("created_by")

        if self._deep_requested():
            qs = qs.prefetch_related("memberships")

        qs = apply_search_filter(qs, self.request, ngram_size=3, threshold=0.5)

        return qs

    def get_object(self):
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        obj_id = self.kwargs.get(lookup_url_kwarg)
        company = get_object_or_404(
            Company.objects.select_related("created_by").prefetch_related("memberships"),
            pk=obj_id,
        )
        self._ensure_company_access(self.request.user, company)
        self.check_object_permissions(self.request, company)
        return company

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
