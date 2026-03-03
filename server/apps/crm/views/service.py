from apps.users.permissions import IsMemberOrCreatedBy
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Service
from ..serializers import ServiceSerializer
from .common import BaseCompanyScopedViewSet


class ServiceViewSet(BaseCompanyScopedViewSet):
    model = Service
    serializer_class = ServiceSerializer
    select_related_fields = ("company",)

    def get_permissions(self):
        if self.action == "retrieve":
            perms = [IsAuthenticated(), IsMemberOrCreatedBy()]
        elif self.action in ("partial_update", "update"):
            perms = [IsAuthenticated(), IsMemberOrCreatedBy()]
        elif self.action == "destroy":
            perms = [IsAuthenticated(), IsMemberOrCreatedBy()]
        elif self.action == "list":
            perms = [IsAuthenticated()]
        elif self.action == "create":
            perms = [IsAuthenticated(), IsMemberOrCreatedBy()]
        else:
            perms = [IsAuthenticated()]
        return perms

    def perform_create(self, serializer):
        serializer.save()

    def perform_update(self, serializer):
        actor = self.request.user
        instance = serializer.instance
        new_company = serializer.validated_data.get("company", instance.company)

        if not self._is_admin(actor) and not self._is_agent(actor):
            if new_company.id != instance.company.id:
                raise PermissionDenied("Members cannot change company of the service.")

        if self._is_agent(actor) and not self._is_agent_owner_of_company(actor, new_company):
            raise PermissionDenied("Agents can only update services for their own companies.")

        serializer.save()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.soft_delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
