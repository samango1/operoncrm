from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema
from apps.users.permissions import IsMemberOrCreatedBy
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Client, ClientService
from ..serializers import ClientSerializer, ClientServiceSerializer
from .common import BaseCompanyScopedViewSet


class ClientViewSet(BaseCompanyScopedViewSet):
    model = Client
    serializer_class = ClientSerializer
    select_related_fields = ("company", "created_by")
    member_valid_only = True
    allow_valid_param_filter = True
    deep_shallow_get_actions = ("services",)

    def get_permissions(self):
        if self.action == "retrieve":
            perms = [IsAuthenticated(), IsMemberOrCreatedBy()]
        elif self.action == "services":
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
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        actor = self.request.user
        instance = serializer.instance
        new_company = serializer.validated_data.get("company", instance.company)

        if not self._is_admin(actor) and not self._is_agent(actor):
            if new_company.id != instance.company.id:
                raise PermissionDenied("Members cannot change company of the client.")

        if self._is_agent(actor) and not self._is_agent_owner_of_company(actor, new_company):
            raise PermissionDenied("Agents can only update clients for their own companies.")

        serializer.save()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.soft_delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="id",
                location=OpenApiParameter.PATH,
                required=True,
                type=OpenApiTypes.UUID,
                description="Client id",
            ),
            OpenApiParameter(
                name="deep",
                location=OpenApiParameter.QUERY,
                required=False,
                type=OpenApiTypes.BOOL,
                description="Include expanded nested objects.",
            ),
        ],
        operation_id="clients_services_list",
        responses={200: ClientServiceSerializer(many=True)},
    )
    @action(detail=True, methods=["get"], url_path="services")
    def services(self, request, id=None):
        client = self.get_object()
        base_qs = ClientService.objects.filter(client=client, company=client.company)
        base_qs.expire_overdue()
        qs = base_qs.select_related("client", "service", "transaction")
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = ClientServiceSerializer(page, many=True, context=self._serializer_context(request))
            return self.get_paginated_response(serializer.data)
        serializer = ClientServiceSerializer(qs, many=True, context=self._serializer_context(request))
        return Response(serializer.data, status=status.HTTP_200_OK)
