from apps.users.permissions import IsAdminOrAgent, IsCreatorOrAdmin, IsMemberOrCreatedBy
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated

from ..models import TransactionCategory
from ..serializers import TransactionCategorySerializer
from .common import BaseCompanyScopedViewSet


class TransactionCategoryViewSet(BaseCompanyScopedViewSet):
    model = TransactionCategory
    serializer_class = TransactionCategorySerializer
    select_related_fields = ("company", "created_by")
    search_fields = ("name",)

    def get_permissions(self):
        if self.action in ("partial_update", "update", "destroy"):
            perms = [IsAuthenticated(), IsCreatorOrAdmin()]
        elif self.action == "create":
            perms = [IsAuthenticated(), IsAdminOrAgent()]
        elif self.action == "retrieve":
            perms = [IsAuthenticated(), IsMemberOrCreatedBy()]
        elif self.action == "list":
            perms = [IsAuthenticated()]
        else:
            perms = [IsAuthenticated()]
        return perms

    def perform_create(self, serializer):
        actor = self.request.user
        company = serializer.validated_data.get("company")
        if self._is_agent(actor) and not self._is_admin(actor):
            if not self._is_agent_owner_of_company(actor, company):
                raise PermissionDenied("Agents can only create categories for their own companies.")
        serializer.save(created_by=actor)

    def perform_update(self, serializer):
        actor = self.request.user
        instance = serializer.instance
        new_company = serializer.validated_data.get("company", instance.company)

        if not self._is_admin(actor) and not self._is_agent(actor):
            if new_company.id != instance.company.id:
                raise PermissionDenied("Members cannot change company of the category.")

        if self._is_agent(actor) and not self._is_admin(actor):
            if not self._is_agent_owner_of_company(actor, new_company):
                raise PermissionDenied("Agents can only update categories for their own companies.")

        serializer.save()
