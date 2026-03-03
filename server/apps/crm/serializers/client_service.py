from rest_framework import serializers

from ..models import Client, ClientService, Service
from .catalog import ServiceField
from .client import ClientField


class ClientServiceSerializer(serializers.ModelSerializer):
    client = ClientField(queryset=Client.objects.all())
    service = ServiceField(queryset=Service.objects.all())
    transaction = serializers.UUIDField(source="transaction_id", read_only=True, allow_null=True)

    class Meta:
        model = ClientService
        fields = [
            "id",
            "client",
            "service",
            "transaction",
            "starts_at",
            "ends_at",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "transaction", "status", "created_at", "updated_at"]
