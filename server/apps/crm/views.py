from django.db.models import Q
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiTypes
from apps.users.mixins import apply_search_filter
from apps.users.permissions import IsAdmin, IsAdminOrAgent, IsCreatorOrAdmin, IsMemberOrCreatedBy, CompanyAccessMixin
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication

from .models import Company, Transaction, Client
from .serializers import CompanySerializer, TransactionSerializer, ClientSerializer


class CompanyAccessMixinLocal(CompanyAccessMixin):
    def _ensure_company_access(self, user, company):
        if self._is_admin(user) or self._is_agent_owner_of_company(user, company) or self._is_member_of_company(user, company):
            return
        raise PermissionDenied("You do not have access to this company's resources.")

    def _qs_for_related(self, company, rel_name, user, hide_invalid_for_members=True):
        qs = getattr(company, rel_name).all()
        model = getattr(qs, "model", None)

        if model is None:
            select_fields = ("company", "created_by")
        else:
            model_name = getattr(model, "__name__", "").lower()
            if model_name == "transaction":
                select_fields = ("company", "client")
            elif model_name == "client":
                select_fields = ("company", "created_by")
            else:
                select_fields = ("company", "created_by")

        try:
            qs = qs.select_related(*select_fields)
        except Exception:
            qs = qs

        if hide_invalid_for_members and not (self._is_admin(user) or self._is_agent_owner_of_company(user, company)):
            qs = qs.filter(invalid=False)
        return qs

    def _validate_company_change(self, actor, current_company, new_company_raw):
        if not new_company_raw:
            return None

        new_company_id = new_company_raw.get("id") if isinstance(new_company_raw, dict) else new_company_raw

        if not new_company_id:
            return None

        if not (self._is_admin(actor) or self._is_agent(actor)):
            raise PermissionDenied("Members cannot change company of the resource.")

        if self._is_agent(actor) and not self._is_admin(actor):
            try:
                new_company = Company.objects.get(pk=new_company_id)
            except Company.DoesNotExist:
                raise NotFound("Target company does not exist.")
            if not self._is_agent_owner_of_company(actor, new_company):
                raise PermissionDenied("Agents can only set company to their own companies.")
            return new_company

        return None

    def _handle_list_create_related(self, request, company, rel_name, serializer_class):
        user = request.user
        self._ensure_company_access(user, company)

        if request.method == "GET":
            qs = self._qs_for_related(company, rel_name, user)
            qs = apply_search_filter(qs, request, ngram_size=3, threshold=0.5)
            page = self.paginate_queryset(qs)
            if page is not None:
                serializer = serializer_class(page, many=True, context={"request": request})
                return self.get_paginated_response(serializer.data)
            serializer = serializer_class(qs, many=True, context={"request": request})
            return Response(serializer.data, status=status.HTTP_200_OK)

        serializer = serializer_class(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save(company=company)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def _handle_related_detail(self, request, company, obj_pk, model, serializer_class):
        user = request.user
        self._ensure_company_access(user, company)

        if model is Transaction:
            sel = model.objects.select_related("company", "client")
        elif model is Client:
            sel = model.objects.select_related("company", "created_by")
        else:
            sel = model.objects.select_related("company", "created_by")

        instance = get_object_or_404(sel, pk=obj_pk, company=company)

        if request.method == "GET":
            serializer = serializer_class(instance, context={"request": request})
            return Response(serializer.data, status=status.HTTP_200_OK)

        if request.method in ("PATCH", "PUT"):
            partial = request.method == "PATCH"
            actor = user
            new_company_raw = request.data.get("company")

            self._validate_company_change(actor, company, new_company_raw)

            serializer = serializer_class(instance, data=request.data, partial=partial, context={"request": request})
            serializer.is_valid(raise_exception=True)

            if not (self._is_admin(actor) or self._is_agent(actor)):
                serializer.validated_data.pop("company", None)

            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)

        if request.method == "DELETE":
            if not (self._is_admin(user) or self._is_agent_owner_of_company(user, company) or self._is_member_of_company(user, company)):
                raise PermissionDenied("You do not have permission to delete this resource.")
            instance.soft_delete()
            return Response(status=status.HTTP_204_NO_CONTENT)


class CompanyViewSet(CompanyAccessMixinLocal, viewsets.ModelViewSet):
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
        elif self.action == "slug_to_id":
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

        company_qs = Company.objects.filter(memberships__user=user).select_related("created_by").distinct()
        if not company_qs.exists():
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

        page = self.paginate_queryset(company_qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(company_qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        parameters=[OpenApiParameter(name="slug", required=True, type=OpenApiTypes.STR, description="Company slug")],
        operation_id="companies_slug_to_id",
    )
    @action(detail=False, methods=["get"], url_path=r"slug/(?P<slug>[^/.]+)")
    def slug_to_id(self, request, slug=None):
        company = get_object_or_404(Company.objects.all(), slug=slug)
        return Response({"id": str(company.id)}, status=status.HTTP_200_OK)

    @extend_schema(
        parameters=[OpenApiParameter(name="id", required=True, type=OpenApiTypes.UUID, description="Company id")],
        operation_id="companies_transactions_list",
    )
    @action(detail=True, methods=["get", "post"], url_path="transactions")
    def transactions(self, request, id=None):
        company = self.get_object()
        return self._handle_list_create_related(request, company, rel_name="transactions", serializer_class=TransactionSerializer)

    @extend_schema(
        parameters=[
            OpenApiParameter(name="id", required=True, type=OpenApiTypes.UUID, description="Company id"),
            OpenApiParameter(name="transaction_id", required=True, type=OpenApiTypes.UUID, description="Transaction id"),
        ],
        operation_id="companies_transactions_detail",
    )
    @action(detail=True, methods=["get", "patch", "put", "delete"], url_path=r"transactions/(?P<transaction_id>[^/.]+)")
    def transaction_detail(self, request, id=None, transaction_id=None):
        company = self.get_object()
        return self._handle_related_detail(request, company, obj_pk=transaction_id, model=Transaction, serializer_class=TransactionSerializer)

    @extend_schema(
        parameters=[OpenApiParameter(name="id", required=True, type=OpenApiTypes.UUID, description="Company id")],
        operation_id="companies_clients_list",
    )
    @action(detail=True, methods=["get", "post"], url_path="clients")
    def clients(self, request, id=None):
        company = self.get_object()
        return self._handle_list_create_related(request, company, rel_name="clients", serializer_class=ClientSerializer)

    @extend_schema(
        parameters=[
            OpenApiParameter(name="id", required=True, type=OpenApiTypes.UUID, description="Company id"),
            OpenApiParameter(name="client_id", required=True, type=OpenApiTypes.UUID, description="Client id"),
        ],
        operation_id="companies_clients_detail",
    )
    @action(detail=True, methods=["get", "patch", "put", "delete"], url_path=r"clients/(?P<client_id>[^/.]+)")
    def client_detail(self, request, id=None, client_id=None):
        company = self.get_object()
        return self._handle_related_detail(request, company, obj_pk=client_id, model=Client, serializer_class=ClientSerializer)

    def retrieve(self, request, *args, **kwargs):
        return super().retrieve(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        return super().destroy(request, *args, **kwargs)


class ClientViewSet(CompanyAccessMixinLocal, viewsets.ModelViewSet):
    queryset = Client.objects.all().select_related("company", "created_by")
    serializer_class = ClientSerializer
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

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Client.objects.none()

        base_qs = Client.objects.select_related("company", "created_by")

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
                return Client.objects.none()

            qs = base_qs.filter(company_id__in=company_ids, invalid=False)

        qs = apply_search_filter(qs, self.request, ngram_size=3, threshold=0.5)
        return qs

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        self.check_object_permissions(request, instance)
        return super().retrieve(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        actor = self.request.user
        instance = serializer.instance
        new_company = serializer.validated_data.get("company", instance.company)

        self.check_object_permissions(self.request, instance)

        if not self._is_admin(actor) and not self._is_agent(actor):
            if new_company.id != instance.company.id:
                raise PermissionDenied("Members cannot change company of the client.")

        if self._is_agent(actor) and not self._is_agent_owner_of_company(actor, new_company):
            raise PermissionDenied("Agents can only update clients for their own companies.")

        serializer.save()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.check_object_permissions(request, instance)
        instance.soft_delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class TransactionViewSet(CompanyAccessMixinLocal, viewsets.ModelViewSet):
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
        instance.soft_delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
