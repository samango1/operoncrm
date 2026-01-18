from django.db.models import Q
from apps.users.mixins import apply_search_filter
from apps.users.permissions import IsAdmin, IsAdminOrAgent, IsCreatorOrAdmin, IsMemberOrCreatedBy
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication

from .models import Company, Transaction
from .serializers import CompanySerializer, TransactionSerializer


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


class TransactionViewSet(viewsets.ModelViewSet):
    queryset = Transaction.objects.all().select_related("company", "client")
    serializer_class = TransactionSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    lookup_field = "id"

    def get_permissions(self):
        if self.action == "retrieve":
            perms = [IsAuthenticated(), IsMemberOrCreatedBy()]
        elif self.action in ("partial_update", "update"):
            perms = [IsAuthenticated(), IsMemberOrCreatedBy()]
        elif self.action == "destroy":
            perms = [IsAuthenticated(), IsMemberOrCreatedBy()]
        elif self.action == "list":
            perms = [IsAuthenticated(), IsAdminOrAgent()]
        elif self.action == "create":
            perms = [IsAuthenticated(), IsMemberOrCreatedBy()]
        else:
            perms = [IsAuthenticated()]
        return perms

    def _is_admin(self, user):
        return getattr(user, "is_admin", False)

    def _is_agent(self, user):
        return getattr(user, "is_agent", False)

    def _is_agent_owner_of_company(self, user, company):
        return bool(company and company.created_by_id == user.id)

    def _is_member_of_company(self, user, company):
        if not company:
            return False
        members = company.members or []
        uid = str(user.id)
        for m in members:
            if str(m.get("id")) == uid:
                return True
        return False

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Transaction.objects.none()

        base_qs = Transaction.objects.select_related("company", "client")

        if self._is_admin(user):
            qs = base_qs.all()
        elif self._is_agent(user):
            qs = base_qs.filter(company__created_by=user)
        else:
            company_ids = []
            for c in Company.objects.all():
                if self._is_member_of_company(user, c):
                    company_ids.append(c.id)

            if not company_ids:
                return Transaction.objects.none()

            qs = base_qs.filter(company_id__in=company_ids, invalid=False)

        qs = apply_search_filter(qs, self.request, ngram_size=3, threshold=0.5)
        return qs

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        self.check_object_permissions(request, instance)
        return super().retrieve(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save()

    def perform_update(self, serializer):
        actor = self.request.user
        instance = serializer.instance
        new_company = serializer.validated_data.get("company", instance.company)

        self.check_object_permissions(self.request, instance)

        if not self._is_admin(actor) and not self._is_agent(actor):
            if new_company.id != instance.company.id:
                raise PermissionDenied("Members cannot change company of the transaction.")

        if self._is_agent(actor) and not self._is_agent_owner_of_company(actor, new_company):
            raise PermissionDenied("Agents can only update transactions for their own companies.")

        serializer.save()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.check_object_permissions(request, instance)

        instance.invalid = True
        instance.save(update_fields=["invalid", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)