from django.core.exceptions import FieldDoesNotExist
from django.db import transaction
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

from .models import Company, Transaction, Client, TransactionCategory, Product, Service, ClientService
from .serializers import (
    CompanySerializer,
    TransactionSerializer,
    ClientSerializer,
    TransactionCategorySerializer,
    ProductSerializer,
    ServiceSerializer,
    ClientServiceSerializer,
)


class CompanyAccessMixinLocal(CompanyAccessMixin):
    def _get_valid_param(self, request):
        raw = request.query_params.get("valid")
        if raw is None:
            return None
        if isinstance(raw, str):
            val = raw.strip().lower()
            if val in ("true", "1", "yes"):
                return True
            if val in ("false", "0", "no"):
                return False
        return None

    def _apply_valid_filter(self, qs, request):
        valid_value = self._get_valid_param(request)
        if valid_value is None:
            return qs
        model = getattr(qs, "model", None)
        if model is None:
            return qs
        try:
            model._meta.get_field("valid")
        except FieldDoesNotExist:
            return qs
        return qs.filter(valid=valid_value)

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
            elif model_name == "transactioncategory":
                select_fields = ("company", "created_by")
            elif model_name == "product":
                select_fields = ("company",)
            elif model_name == "service":
                select_fields = ("company",)
            else:
                select_fields = ("company", "created_by")

        try:
            qs = qs.select_related(*select_fields)
        except Exception:
            qs = qs

        if getattr(model, "__name__", "").lower() == "transaction":
            qs = qs.prefetch_related(
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

        if hide_invalid_for_members and not (self._is_admin(user) or self._is_agent_owner_of_company(user, company)):
            try:
                if model is not None:
                    model._meta.get_field("valid")
            except FieldDoesNotExist:
                pass
            else:
                qs = qs.filter(valid=True)
        return qs

    def _validate_company_change(self, actor, current_company, new_company_raw):
        if not new_company_raw:
            return None

        new_company_id = new_company_raw.get("id") if isinstance(new_company_raw, dict) else new_company_raw

        if not new_company_id:
            return None

        if current_company and str(new_company_id) == str(current_company.id):
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
            base_qs = self._qs_for_related(company, rel_name, user)
            base_qs = self._apply_valid_filter(base_qs, request)
            qs = apply_search_filter(base_qs, request, ngram_size=3, threshold=0.5)
            if rel_name == "transactions":
                q = request.query_params.get("search")
                if q:
                    category_qs = base_qs.filter(categories__name__icontains=q)
                    qs = (qs | category_qs).distinct()
            page = self.paginate_queryset(qs)
            if page is not None:
                serializer = serializer_class(page, many=True, context={"request": request})
                return self.get_paginated_response(serializer.data)
            serializer = serializer_class(qs, many=True, context={"request": request})
            return Response(serializer.data, status=status.HTTP_200_OK)

        serializer = serializer_class(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        save_kwargs = {"company": company}
        if "created_by" in getattr(serializer, "fields", {}):
            save_kwargs["created_by"] = user
        serializer.save(**save_kwargs)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def _handle_related_detail(self, request, company, obj_pk, model, serializer_class):
        user = request.user
        self._ensure_company_access(user, company)

        if model is Transaction:
            sel = model.objects.select_related("company", "client").prefetch_related(
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
        elif model is Client:
            sel = model.objects.select_related("company", "created_by")
        elif model is TransactionCategory:
            sel = model.objects.select_related("company", "created_by")
        elif model is Product:
            sel = model.objects.select_related("company")
        elif model is Service:
            sel = model.objects.select_related("company")
        else:
            sel = model.objects.select_related("company", "created_by")

        instance = get_object_or_404(sel, pk=obj_pk, company=company)
        self.check_object_permissions(request, instance)

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

        qs = apply_search_filter(qs, self.request, ngram_size=3, threshold=0.5)

        return qs

    def get_object(self):
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        obj_id = self.kwargs.get(lookup_url_kwarg)
        company = get_object_or_404(Company.objects.select_related("created_by"), pk=obj_id)
        self._ensure_company_access(self.request.user, company)
        self.check_object_permissions(self.request, company)
        return company

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @extend_schema(
        parameters=[OpenApiParameter(name="slug", required=True, type=OpenApiTypes.STR, description="Company slug")],
        operation_id="companies_slug_to_id",
    )
    @action(detail=False, methods=["get"], url_path=r"slug/(?P<slug>[^/.]+)")
    def slug_to_id(self, request, slug=None):
        company = get_object_or_404(Company.objects.select_related("created_by"), slug=slug)
        self._ensure_company_access(request.user, company)
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
        parameters=[OpenApiParameter(name="id", required=True, type=OpenApiTypes.UUID, description="Company id")],
        operation_id="companies_products_list",
    )
    @action(detail=True, methods=["get", "post"], url_path="products")
    def products(self, request, id=None):
        company = self.get_object()
        return self._handle_list_create_related(request, company, rel_name="products", serializer_class=ProductSerializer)

    @extend_schema(
        parameters=[
            OpenApiParameter(name="id", required=True, type=OpenApiTypes.UUID, description="Company id"),
            OpenApiParameter(name="product_id", required=True, type=OpenApiTypes.UUID, description="Product id"),
        ],
        operation_id="companies_products_detail",
    )
    @action(detail=True, methods=["get", "patch", "put", "delete"], url_path=r"products/(?P<product_id>[^/.]+)")
    def product_detail(self, request, id=None, product_id=None):
        company = self.get_object()
        return self._handle_related_detail(request, company, obj_pk=product_id, model=Product, serializer_class=ProductSerializer)

    @extend_schema(
        parameters=[OpenApiParameter(name="id", required=True, type=OpenApiTypes.UUID, description="Company id")],
        operation_id="companies_services_list",
    )
    @action(detail=True, methods=["get", "post"], url_path="services")
    def services(self, request, id=None):
        company = self.get_object()
        return self._handle_list_create_related(request, company, rel_name="services", serializer_class=ServiceSerializer)

    @extend_schema(
        parameters=[
            OpenApiParameter(name="id", required=True, type=OpenApiTypes.UUID, description="Company id"),
            OpenApiParameter(name="service_id", required=True, type=OpenApiTypes.UUID, description="Service id"),
        ],
        operation_id="companies_services_detail",
    )
    @action(detail=True, methods=["get", "patch", "put", "delete"], url_path=r"services/(?P<service_id>[^/.]+)")
    def service_detail(self, request, id=None, service_id=None):
        company = self.get_object()
        return self._handle_related_detail(request, company, obj_pk=service_id, model=Service, serializer_class=ServiceSerializer)

    @extend_schema(
        parameters=[OpenApiParameter(name="id", required=True, type=OpenApiTypes.UUID, description="Company id")],
        operation_id="companies_transaction_categories_list",
    )
    @action(detail=True, methods=["get", "post"], url_path="transaction-categories")
    def transaction_categories(self, request, id=None):
        company = self.get_object()
        user = request.user

        if request.method == "GET":
            return self._handle_list_create_related(
                request,
                company,
                rel_name="transaction_categories",
                serializer_class=TransactionCategorySerializer,
            )

        if not (self._is_admin(user) or self._is_agent(user)):
            raise PermissionDenied("Only admins or agents can create transaction categories.")
        if self._is_agent(user) and not self._is_admin(user):
            if not self._is_agent_owner_of_company(user, company):
                raise PermissionDenied("Agents can only create categories for their own companies.")

        serializer = TransactionCategorySerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save(company=company, created_by=user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

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

    @extend_schema(
        parameters=[
            OpenApiParameter(name="id", required=True, type=OpenApiTypes.UUID, description="Company id"),
            OpenApiParameter(name="category_id", required=True, type=OpenApiTypes.UUID, description="Category id"),
        ],
        operation_id="companies_transaction_categories_detail",
    )
    @action(detail=True, methods=["get", "patch", "put", "delete"], url_path=r"transaction-categories/(?P<category_id>[^/.]+)")
    def transaction_category_detail(self, request, id=None, category_id=None):
        company = self.get_object()
        user = request.user
        self._ensure_company_access(user, company)
        instance = get_object_or_404(
            TransactionCategory.objects.select_related("company", "created_by"),
            pk=category_id,
            company=company,
        )

        if request.method == "GET":
            serializer = TransactionCategorySerializer(instance, context={"request": request})
            return Response(serializer.data, status=status.HTTP_200_OK)

        if request.method in ("PATCH", "PUT"):
            if not (self._is_admin(user) or instance.created_by_id == user.id):
                raise PermissionDenied("You do not have permission to update this category.")

            new_company_raw = request.data.get("company")
            self._validate_company_change(user, company, new_company_raw)

            serializer = TransactionCategorySerializer(
                instance,
                data=request.data,
                partial=request.method == "PATCH",
                context={"request": request},
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)

        if request.method == "DELETE":
            if not (self._is_admin(user) or instance.created_by_id == user.id):
                raise PermissionDenied("You do not have permission to delete this category.")
            instance.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

class ClientViewSet(CompanyAccessMixinLocal, viewsets.ModelViewSet):
    queryset = Client.objects.all().select_related("company", "created_by")
    serializer_class = ClientSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    lookup_field = "id"

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
            perms = [IsAuthenticated()]
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
            company_ids = list(self._user_companies_qs(user).values_list("id", flat=True))
            if not company_ids:
                return Client.objects.none()
            qs = base_qs.filter(company_id__in=company_ids, valid=True)

        qs = self._apply_valid_filter(qs, self.request)
        qs = apply_search_filter(qs, self.request, ngram_size=3, threshold=0.5)
        return qs

    def get_object(self):
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        obj_id = self.kwargs.get(lookup_url_kwarg)
        instance = get_object_or_404(Client.objects.select_related("company", "created_by"), pk=obj_id)
        self._ensure_company_access(self.request.user, instance.company)
        self.check_object_permissions(self.request, instance)
        return instance

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
        parameters=[OpenApiParameter(name="id", required=True, type=OpenApiTypes.UUID, description="Client id")],
        operation_id="clients_services_list",
    )
    @action(detail=True, methods=["get"], url_path="services")
    def services(self, request, id=None):
        client = self.get_object()
        base_qs = ClientService.objects.filter(client=client, company=client.company)
        base_qs.expire_overdue()
        qs = base_qs.select_related("client", "service", "transaction")
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = ClientServiceSerializer(page, many=True, context={"request": request})
            return self.get_paginated_response(serializer.data)
        serializer = ClientServiceSerializer(qs, many=True, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class TransactionViewSet(CompanyAccessMixinLocal, viewsets.ModelViewSet):
    queryset = Transaction.objects.all().select_related("company", "client").prefetch_related(
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
            perms = [IsAuthenticated()]
        elif self.action == "create":
            perms = [IsAuthenticated(), IsMemberOrCreatedBy()]
        else:
            perms = [IsAuthenticated()]
        return perms

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Transaction.objects.none()

        base_qs = Transaction.objects.select_related("company", "client").prefetch_related(
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

        if self._is_admin(user):
            qs = base_qs.all()
        elif self._is_agent(user):
            qs = base_qs.filter(company__created_by=user)
        else:
            company_ids = list(self._user_companies_qs(user).values_list("id", flat=True))
            if not company_ids:
                return Transaction.objects.none()
            qs = base_qs.filter(company_id__in=company_ids, valid=True)

        qs = self._apply_valid_filter(qs, self.request)
        role_qs = qs
        qs = apply_search_filter(role_qs, self.request, ngram_size=3, threshold=0.5)
        q = self.request.query_params.get("search")
        if q:
            category_qs = role_qs.filter(categories__name__icontains=q)
            qs = (qs | category_qs).distinct()
        return qs

    def get_object(self):
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        obj_id = self.kwargs.get(lookup_url_kwarg)
        instance = get_object_or_404(
            Transaction.objects.select_related("company", "client").prefetch_related(
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
            ),
            pk=obj_id,
        )
        self._ensure_company_access(self.request.user, instance.company)
        self.check_object_permissions(self.request, instance)
        return instance

    def perform_create(self, serializer):
        company = serializer.validated_data.get("company")
        if company is None:
            raise PermissionDenied("Company is required.")
        self._ensure_company_access(self.request.user, company)
        products = serializer.validated_data.get("products") or []
        transaction_type = serializer.validated_data.get("type")
        stock_delta = Transaction.stock_delta_for_type(transaction_type)
        with transaction.atomic():
            serializer.save()
            if products and stock_delta:
                Product.adjust_stock(products, stock_delta)

    def perform_update(self, serializer):
        actor = self.request.user
        instance = serializer.instance
        new_company = serializer.validated_data.get("company", instance.company)

        if not self._is_admin(actor) and not self._is_agent(actor):
            if new_company.id != instance.company.id:
                raise PermissionDenied("Members cannot change company of the transaction.")

        if self._is_agent(actor) and not self._is_agent_owner_of_company(actor, new_company):
            raise PermissionDenied("Agents can only update transactions for their own companies.")

        serializer.save()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.soft_delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class TransactionCategoryViewSet(CompanyAccessMixinLocal, viewsets.ModelViewSet):
    queryset = TransactionCategory.objects.all().select_related("company", "created_by")
    serializer_class = TransactionCategorySerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    lookup_field = "id"

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

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return TransactionCategory.objects.none()

        base_qs = TransactionCategory.objects.select_related("company", "created_by")

        if self._is_admin(user):
            qs = base_qs.all()
        elif self._is_agent(user):
            qs = base_qs.filter(company__created_by=user)
        else:
            company_ids = list(self._user_companies_qs(user).values_list("id", flat=True))
            if not company_ids:
                return TransactionCategory.objects.none()
            qs = base_qs.filter(company_id__in=company_ids)

        qs = apply_search_filter(qs, self.request, ngram_size=3, threshold=0.5, search_fields=["name"])
        return qs

    def get_object(self):
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        obj_id = self.kwargs.get(lookup_url_kwarg)
        instance = get_object_or_404(TransactionCategory.objects.select_related("company", "created_by"), pk=obj_id)
        self._ensure_company_access(self.request.user, instance.company)
        self.check_object_permissions(self.request, instance)
        return instance

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


class ProductViewSet(CompanyAccessMixinLocal, viewsets.ModelViewSet):
    queryset = Product.objects.all().select_related("company")
    serializer_class = ProductSerializer
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
            perms = [IsAuthenticated()]
        elif self.action == "create":
            perms = [IsAuthenticated(), IsMemberOrCreatedBy()]
        else:
            perms = [IsAuthenticated()]
        return perms

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Product.objects.none()

        base_qs = Product.objects.select_related("company")

        if self._is_admin(user):
            qs = base_qs.all()
        elif self._is_agent(user):
            qs = base_qs.filter(company__created_by=user)
        else:
            company_ids = list(self._user_companies_qs(user).values_list("id", flat=True))
            if not company_ids:
                return Product.objects.none()
            qs = base_qs.filter(company_id__in=company_ids)

        qs = apply_search_filter(qs, self.request, ngram_size=3, threshold=0.5)
        return qs

    def get_object(self):
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        obj_id = self.kwargs.get(lookup_url_kwarg)
        instance = get_object_or_404(Product.objects.select_related("company"), pk=obj_id)
        self._ensure_company_access(self.request.user, instance.company)
        self.check_object_permissions(self.request, instance)
        return instance

    def perform_create(self, serializer):
        serializer.save()

    def perform_update(self, serializer):
        actor = self.request.user
        instance = serializer.instance
        new_company = serializer.validated_data.get("company", instance.company)

        if not self._is_admin(actor) and not self._is_agent(actor):
            if new_company.id != instance.company.id:
                raise PermissionDenied("Members cannot change company of the product.")

        if self._is_agent(actor) and not self._is_agent_owner_of_company(actor, new_company):
            raise PermissionDenied("Agents can only update products for their own companies.")

        serializer.save()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.soft_delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ServiceViewSet(CompanyAccessMixinLocal, viewsets.ModelViewSet):
    queryset = Service.objects.all().select_related("company")
    serializer_class = ServiceSerializer
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
            perms = [IsAuthenticated()]
        elif self.action == "create":
            perms = [IsAuthenticated(), IsMemberOrCreatedBy()]
        else:
            perms = [IsAuthenticated()]
        return perms

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Service.objects.none()

        base_qs = Service.objects.select_related("company")

        if self._is_admin(user):
            qs = base_qs.all()
        elif self._is_agent(user):
            qs = base_qs.filter(company__created_by=user)
        else:
            company_ids = list(self._user_companies_qs(user).values_list("id", flat=True))
            if not company_ids:
                return Service.objects.none()
            qs = base_qs.filter(company_id__in=company_ids)

        qs = apply_search_filter(qs, self.request, ngram_size=3, threshold=0.5)
        return qs

    def get_object(self):
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        obj_id = self.kwargs.get(lookup_url_kwarg)
        instance = get_object_or_404(Service.objects.select_related("company"), pk=obj_id)
        self._ensure_company_access(self.request.user, instance.company)
        self.check_object_permissions(self.request, instance)
        return instance

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
