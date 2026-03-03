from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from ..models import Client, Company, Product, Service, Transaction, TransactionCategory
from ..serializers import (
    ClientSerializer,
    ProductSerializer,
    ServiceSerializer,
    TransactionCategorySerializer,
    TransactionSerializer,
)


COMPANY_ID_PATH_PARAMETER = OpenApiParameter(
    name="id",
    location=OpenApiParameter.PATH,
    required=True,
    type=OpenApiTypes.UUID,
    description="Company id",
)

DEEP_QUERY_PARAMETER = OpenApiParameter(
    name="deep",
    location=OpenApiParameter.QUERY,
    required=False,
    type=OpenApiTypes.BOOL,
    description="Include expanded nested objects.",
)

SEARCH_QUERY_PARAMETER = OpenApiParameter(
    name="search",
    location=OpenApiParameter.QUERY,
    required=False,
    type=OpenApiTypes.STR,
    description="Fuzzy search query.",
)

VALID_QUERY_PARAMETER = OpenApiParameter(
    name="valid",
    location=OpenApiParameter.QUERY,
    required=False,
    type=OpenApiTypes.BOOL,
    description="Filter by validity flag when supported by resource.",
)


class CompanyRelatedActionsMixin:
    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="slug",
                location=OpenApiParameter.PATH,
                required=True,
                type=OpenApiTypes.STR,
                description="Company slug",
            )
        ],
    )
    @extend_schema(
        methods=["get"],
        operation_id="companies_slug_to_id",
        responses={
            200: inline_serializer(
                name="CompanySlugIdResponse",
                fields={"id": serializers.UUIDField()},
            )
        },
    )
    @action(detail=False, methods=["get"], url_path=r"slug/(?P<slug>[^/.]+)")
    def slug_to_id(self, request, slug=None):
        company = get_object_or_404(Company.objects.select_related("created_by"), slug=slug)
        self._ensure_company_access(request.user, company)
        return Response({"id": str(company.id)}, status=status.HTTP_200_OK)

    @extend_schema(
        parameters=[
            COMPANY_ID_PATH_PARAMETER,
        ],
    )
    @extend_schema(
        methods=["get"],
        operation_id="companies_transactions_list",
        parameters=[SEARCH_QUERY_PARAMETER, VALID_QUERY_PARAMETER, DEEP_QUERY_PARAMETER],
        responses={200: TransactionSerializer(many=True)},
    )
    @extend_schema(
        methods=["post"],
        operation_id="companies_transactions_create",
        responses={201: TransactionSerializer},
    )
    @action(detail=True, methods=["get", "post"], url_path="transactions")
    def transactions(self, request, id=None):
        company = self.get_object()
        return self._handle_list_create_related(request, company, rel_name="transactions", serializer_class=TransactionSerializer)

    @extend_schema(
        parameters=[
            COMPANY_ID_PATH_PARAMETER,
            OpenApiParameter(
                name="transaction_id",
                location=OpenApiParameter.PATH,
                required=True,
                type=OpenApiTypes.UUID,
                description="Transaction id",
            ),
        ],
    )
    @extend_schema(
        methods=["get"],
        operation_id="companies_transactions_retrieve",
        parameters=[DEEP_QUERY_PARAMETER],
        responses={200: TransactionSerializer},
    )
    @extend_schema(
        methods=["patch"],
        operation_id="companies_transactions_partial_update",
        responses={200: TransactionSerializer},
    )
    @extend_schema(
        methods=["put"],
        operation_id="companies_transactions_update",
        responses={200: TransactionSerializer},
    )
    @extend_schema(methods=["delete"], operation_id="companies_transactions_destroy", responses={204: None})
    @action(detail=True, methods=["get", "patch", "put", "delete"], url_path=r"transactions/(?P<transaction_id>[^/.]+)")
    def transaction_detail(self, request, id=None, transaction_id=None):
        company = self.get_object()
        return self._handle_related_detail(request, company, obj_pk=transaction_id, model=Transaction, serializer_class=TransactionSerializer)

    @extend_schema(
        parameters=[
            COMPANY_ID_PATH_PARAMETER,
        ],
    )
    @extend_schema(
        methods=["get"],
        operation_id="companies_clients_list",
        parameters=[SEARCH_QUERY_PARAMETER, VALID_QUERY_PARAMETER, DEEP_QUERY_PARAMETER],
        responses={200: ClientSerializer(many=True)},
    )
    @extend_schema(
        methods=["post"],
        operation_id="companies_clients_create",
        responses={201: ClientSerializer},
    )
    @action(detail=True, methods=["get", "post"], url_path="clients")
    def clients(self, request, id=None):
        company = self.get_object()
        return self._handle_list_create_related(request, company, rel_name="clients", serializer_class=ClientSerializer)

    @extend_schema(
        parameters=[
            COMPANY_ID_PATH_PARAMETER,
        ],
    )
    @extend_schema(
        methods=["get"],
        operation_id="companies_products_list",
        parameters=[SEARCH_QUERY_PARAMETER, DEEP_QUERY_PARAMETER],
        responses={200: ProductSerializer(many=True)},
    )
    @extend_schema(
        methods=["post"],
        operation_id="companies_products_create",
        responses={201: ProductSerializer},
    )
    @action(detail=True, methods=["get", "post"], url_path="products")
    def products(self, request, id=None):
        company = self.get_object()
        return self._handle_list_create_related(request, company, rel_name="products", serializer_class=ProductSerializer)

    @extend_schema(
        parameters=[
            COMPANY_ID_PATH_PARAMETER,
            OpenApiParameter(
                name="product_id",
                location=OpenApiParameter.PATH,
                required=True,
                type=OpenApiTypes.UUID,
                description="Product id",
            ),
        ],
    )
    @extend_schema(
        methods=["get"],
        operation_id="companies_products_retrieve",
        parameters=[DEEP_QUERY_PARAMETER],
        responses={200: ProductSerializer},
    )
    @extend_schema(
        methods=["patch"],
        operation_id="companies_products_partial_update",
        responses={200: ProductSerializer},
    )
    @extend_schema(
        methods=["put"],
        operation_id="companies_products_update",
        responses={200: ProductSerializer},
    )
    @extend_schema(methods=["delete"], operation_id="companies_products_destroy", responses={204: None})
    @action(detail=True, methods=["get", "patch", "put", "delete"], url_path=r"products/(?P<product_id>[^/.]+)")
    def product_detail(self, request, id=None, product_id=None):
        company = self.get_object()
        return self._handle_related_detail(request, company, obj_pk=product_id, model=Product, serializer_class=ProductSerializer)

    @extend_schema(
        parameters=[
            COMPANY_ID_PATH_PARAMETER,
        ],
    )
    @extend_schema(
        methods=["get"],
        operation_id="companies_services_list",
        parameters=[SEARCH_QUERY_PARAMETER, DEEP_QUERY_PARAMETER],
        responses={200: ServiceSerializer(many=True)},
    )
    @extend_schema(
        methods=["post"],
        operation_id="companies_services_create",
        responses={201: ServiceSerializer},
    )
    @action(detail=True, methods=["get", "post"], url_path="services")
    def services(self, request, id=None):
        company = self.get_object()
        return self._handle_list_create_related(request, company, rel_name="services", serializer_class=ServiceSerializer)

    @extend_schema(
        parameters=[
            COMPANY_ID_PATH_PARAMETER,
            OpenApiParameter(
                name="service_id",
                location=OpenApiParameter.PATH,
                required=True,
                type=OpenApiTypes.UUID,
                description="Service id",
            ),
        ],
    )
    @extend_schema(
        methods=["get"],
        operation_id="companies_services_retrieve",
        parameters=[DEEP_QUERY_PARAMETER],
        responses={200: ServiceSerializer},
    )
    @extend_schema(
        methods=["patch"],
        operation_id="companies_services_partial_update",
        responses={200: ServiceSerializer},
    )
    @extend_schema(
        methods=["put"],
        operation_id="companies_services_update",
        responses={200: ServiceSerializer},
    )
    @extend_schema(methods=["delete"], operation_id="companies_services_destroy", responses={204: None})
    @action(detail=True, methods=["get", "patch", "put", "delete"], url_path=r"services/(?P<service_id>[^/.]+)")
    def service_detail(self, request, id=None, service_id=None):
        company = self.get_object()
        return self._handle_related_detail(request, company, obj_pk=service_id, model=Service, serializer_class=ServiceSerializer)

    @extend_schema(
        parameters=[
            COMPANY_ID_PATH_PARAMETER,
        ],
    )
    @extend_schema(
        methods=["get"],
        operation_id="companies_transaction_categories_list",
        parameters=[SEARCH_QUERY_PARAMETER, DEEP_QUERY_PARAMETER],
        responses={200: TransactionCategorySerializer(many=True)},
    )
    @extend_schema(
        methods=["post"],
        operation_id="companies_transaction_categories_create",
        responses={201: TransactionCategorySerializer},
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

        serializer = TransactionCategorySerializer(data=request.data, context=self._serializer_context(request))
        serializer.is_valid(raise_exception=True)
        serializer.save(company=company, created_by=user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @extend_schema(
        parameters=[
            COMPANY_ID_PATH_PARAMETER,
            OpenApiParameter(
                name="client_id",
                location=OpenApiParameter.PATH,
                required=True,
                type=OpenApiTypes.UUID,
                description="Client id",
            ),
        ],
    )
    @extend_schema(
        methods=["get"],
        operation_id="companies_clients_retrieve",
        parameters=[DEEP_QUERY_PARAMETER],
        responses={200: ClientSerializer},
    )
    @extend_schema(
        methods=["patch"],
        operation_id="companies_clients_partial_update",
        responses={200: ClientSerializer},
    )
    @extend_schema(
        methods=["put"],
        operation_id="companies_clients_update",
        responses={200: ClientSerializer},
    )
    @extend_schema(methods=["delete"], operation_id="companies_clients_destroy", responses={204: None})
    @action(detail=True, methods=["get", "patch", "put", "delete"], url_path=r"clients/(?P<client_id>[^/.]+)")
    def client_detail(self, request, id=None, client_id=None):
        company = self.get_object()
        return self._handle_related_detail(request, company, obj_pk=client_id, model=Client, serializer_class=ClientSerializer)

    @extend_schema(
        parameters=[
            COMPANY_ID_PATH_PARAMETER,
            OpenApiParameter(
                name="category_id",
                location=OpenApiParameter.PATH,
                required=True,
                type=OpenApiTypes.UUID,
                description="Category id",
            ),
        ],
    )
    @extend_schema(
        methods=["get"],
        operation_id="companies_transaction_categories_retrieve",
        parameters=[DEEP_QUERY_PARAMETER],
        responses={200: TransactionCategorySerializer},
    )
    @extend_schema(
        methods=["patch"],
        operation_id="companies_transaction_categories_partial_update",
        responses={200: TransactionCategorySerializer},
    )
    @extend_schema(
        methods=["put"],
        operation_id="companies_transaction_categories_update",
        responses={200: TransactionCategorySerializer},
    )
    @extend_schema(
        methods=["delete"],
        operation_id="companies_transaction_categories_destroy",
        responses={204: None},
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
            serializer = TransactionCategorySerializer(instance, context=self._serializer_context(request))
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
                context=self._serializer_context(request),
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)

        if request.method == "DELETE":
            if not (self._is_admin(user) or instance.created_by_id == user.id):
                raise PermissionDenied("You do not have permission to delete this category.")
            instance.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
