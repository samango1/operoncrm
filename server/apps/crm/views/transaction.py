from apps.users.permissions import IsMemberOrCreatedBy
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Transaction
from ..serializers import TransactionSerializer
from ..services import TransactionWriteService
from .common import BaseCompanyScopedViewSet


class TransactionViewSet(BaseCompanyScopedViewSet):
    model = Transaction
    serializer_class = TransactionSerializer
    select_related_fields = ("company", "client")
    prefetch_related_fields = (
        "categories",
        "categories__company",
        "categories__created_by",
        "products",
        "products__company",
        "product_items",
        "product_items__product",
        "product_items__product__company",
        "service_items",
        "service_items__service",
        "service_items__service__company",
    )
    member_valid_only = True
    allow_valid_param_filter = True

    def get_permissions(self):
        if self.action in ("retrieve", "partial_update", "update", "destroy", "create"):
            perms = [IsAuthenticated(), IsMemberOrCreatedBy()]
        elif self.action == "list":
            perms = [IsAuthenticated()]
        else:
            perms = [IsAuthenticated()]
        return perms

    def _post_search_queryset(self, role_qs, searched_qs):
        q = self.request.query_params.get("search")
        if not q:
            return searched_qs
        category_qs = role_qs.filter(categories__name__icontains=q)
        return (searched_qs | category_qs).distinct()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        company = serializer.validated_data.get("company")
        if company is None:
            raise PermissionDenied("Company is required.")
        self._ensure_company_access(self.request.user, company)

        instance = TransactionWriteService.create(
            validated_data=serializer.validated_data,
            apply_stock_delta=True,
        )
        out = self.get_serializer(instance)
        headers = self.get_success_headers(out.data)
        return Response(out.data, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)

        actor = self.request.user
        validated_data = dict(serializer.validated_data)
        new_company = validated_data.get("company", instance.company)

        if not self._is_admin(actor) and not self._is_agent(actor):
            if new_company.id != instance.company.id:
                raise PermissionDenied("Members cannot change company of the transaction.")

        if self._is_agent(actor) and not self._is_agent_owner_of_company(actor, new_company):
            raise PermissionDenied("Agents can only update transactions for their own companies.")

        updated = TransactionWriteService.update(instance=instance, validated_data=validated_data)
        out = self.get_serializer(updated)
        return Response(out.data, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.soft_delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
