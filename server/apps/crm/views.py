from decimal import Decimal
from uuid import UUID

from django.core.exceptions import FieldDoesNotExist
from django.db import transaction
from django.db.models import Count, DecimalField, Q, Sum, Value
from django.db.models.functions import Coalesce, TruncDay, TruncMonth, TruncWeek
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_date
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiTypes
from apps.users.mixins import apply_search_filter
from apps.users.permissions import IsAdmin, IsAdminOrAgent, IsCreatorOrAdmin, IsMemberOrCreatedBy, CompanyAccessMixin
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication

from .models import (
    Client,
    ClientService,
    Company,
    Product,
    Service,
    Transaction,
    TransactionCategory,
    TransactionProduct,
    TransactionService,
)
from .serializers import (
    CompanySerializer,
    TransactionSerializer,
    ClientSerializer,
    TransactionCategorySerializer,
    ProductSerializer,
    ServiceSerializer,
    ClientServiceSerializer,
    CompanyStatisticsSerializer,
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
    STATS_GROUP_BY_DAY = "day"
    STATS_GROUP_BY_WEEK = "week"
    STATS_GROUP_BY_MONTH = "month"
    STATS_TOP_DEFAULT = 8
    STATS_TOP_MAX = 50

    STATS_TYPE_LABELS = {
        Transaction.TYPE_INCOME: "Income",
        Transaction.TYPE_OUTCOME: "Outcome",
    }
    STATS_METHOD_LABELS = {
        Transaction.METHOD_CASH: "Cash",
        Transaction.METHOD_CARD: "Card",
    }
    STATS_CURRENCY_LABELS = {
        Transaction.CURRENCY_UZS: "UZS",
        Transaction.CURRENCY_USD: "USD",
    }

    def _split_param_values(self, request, name):
        values = []
        for raw in request.query_params.getlist(name):
            for item in str(raw).split(","):
                clean = item.strip()
                if clean:
                    values.append(clean)
        if not values:
            raw = request.query_params.get(name)
            if raw:
                for item in str(raw).split(","):
                    clean = item.strip()
                    if clean:
                        values.append(clean)
        unique = []
        seen = set()
        for value in values:
            if value in seen:
                continue
            unique.append(value)
            seen.add(value)
        return unique

    def _parse_choice_values(self, request, name, allowed_values):
        values = self._split_param_values(request, name)
        if not values:
            return []
        invalid = [value for value in values if value not in allowed_values]
        if invalid:
            raise ValidationError({name: f"Unsupported values: {', '.join(invalid)}"})
        return values

    def _parse_uuid_values(self, request, name):
        values = self._split_param_values(request, name)
        if not values:
            return []
        normalized = []
        invalid = []
        for value in values:
            try:
                normalized.append(str(UUID(str(value))))
            except (ValueError, TypeError, AttributeError):
                invalid.append(str(value))
        if invalid:
            raise ValidationError({name: f"Invalid UUID values: {', '.join(invalid)}"})
        return normalized

    def _parse_date_value(self, request, name):
        raw = request.query_params.get(name)
        if not raw:
            return None
        parsed = parse_date(raw)
        if parsed is None:
            raise ValidationError({name: "Use YYYY-MM-DD format."})
        return parsed

    def _parse_top_value(self, request):
        raw = request.query_params.get("top")
        if raw in (None, ""):
            return self.STATS_TOP_DEFAULT
        try:
            value = int(raw)
        except (TypeError, ValueError):
            raise ValidationError({"top": "top must be an integer."})
        if value < 1 or value > self.STATS_TOP_MAX:
            raise ValidationError({"top": f"top must be between 1 and {self.STATS_TOP_MAX}."})
        return value

    def _parse_statistics_filters(self, request):
        date_from = self._parse_date_value(request, "date_from")
        date_to = self._parse_date_value(request, "date_to")
        if date_from and date_to and date_from > date_to:
            raise ValidationError({"date_from": "date_from cannot be later than date_to."})

        group_by = request.query_params.get("group_by", self.STATS_GROUP_BY_DAY)
        if group_by not in (
            self.STATS_GROUP_BY_DAY,
            self.STATS_GROUP_BY_WEEK,
            self.STATS_GROUP_BY_MONTH,
        ):
            raise ValidationError({"group_by": "group_by must be day, week or month."})

        return {
            "date_from": date_from,
            "date_to": date_to,
            "group_by": group_by,
            "types": self._parse_choice_values(
                request,
                "types",
                {Transaction.TYPE_INCOME, Transaction.TYPE_OUTCOME},
            ),
            "methods": self._parse_choice_values(
                request,
                "methods",
                {Transaction.METHOD_CASH, Transaction.METHOD_CARD},
            ),
            "currencies": self._parse_choice_values(
                request,
                "currencies",
                {Transaction.CURRENCY_USD, Transaction.CURRENCY_UZS},
            ),
            "category_ids": self._parse_uuid_values(request, "category_ids"),
            "product_ids": self._parse_uuid_values(request, "product_ids"),
            "service_ids": self._parse_uuid_values(request, "service_ids"),
            "client_ids": self._parse_uuid_values(request, "client_ids"),
            "valid": self._get_valid_param(request),
            "top": self._parse_top_value(request),
        }

    def _statistics_base_queryset(self, company, user):
        qs = Transaction.objects.filter(company=company)
        if not (self._is_admin(user) or self._is_agent_owner_of_company(user, company)):
            qs = qs.filter(valid=True)
        return qs

    @staticmethod
    def _to_period_date(value):
        if value is None:
            return None
        if hasattr(value, "date"):
            return value.date()
        return value

    def _build_key_amount_breakdown(self, qs, group_field, label_map):
        zero_decimal = Value(Decimal("0.00"), output_field=DecimalField(max_digits=18, decimal_places=2))
        rows = (
            qs.values(group_field)
            .annotate(
                count=Count("id"),
                amount=Coalesce(Sum("amount"), zero_decimal),
            )
            .order_by(group_field)
        )
        data = []
        for row in rows:
            key = row.get(group_field)
            if not key:
                continue
            data.append(
                {
                    "key": key,
                    "label": label_map.get(key, key),
                    "count": row.get("count", 0),
                    "amount": row.get("amount", Decimal("0.00")),
                }
            )
        return data

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
        parameters=[
            OpenApiParameter(name="id", required=True, type=OpenApiTypes.UUID, description="Company id"),
            OpenApiParameter(name="date_from", required=False, type=OpenApiTypes.DATE, description="Start date in YYYY-MM-DD"),
            OpenApiParameter(name="date_to", required=False, type=OpenApiTypes.DATE, description="End date in YYYY-MM-DD"),
            OpenApiParameter(
                name="group_by",
                required=False,
                type=OpenApiTypes.STR,
                description="Trend grouping: day, week, month",
            ),
            OpenApiParameter(
                name="types",
                required=False,
                type=OpenApiTypes.STR,
                description="Transaction types, comma-separated or repeated param: income,outcome",
            ),
            OpenApiParameter(
                name="methods",
                required=False,
                type=OpenApiTypes.STR,
                description="Transaction methods, comma-separated or repeated param: cash,card",
            ),
            OpenApiParameter(
                name="currencies",
                required=False,
                type=OpenApiTypes.STR,
                description="Currencies, comma-separated or repeated param: UZS,USD",
            ),
            OpenApiParameter(
                name="category_ids",
                required=False,
                type=OpenApiTypes.STR,
                description="Category UUIDs, comma-separated or repeated param",
            ),
            OpenApiParameter(
                name="product_ids",
                required=False,
                type=OpenApiTypes.STR,
                description="Product UUIDs, comma-separated or repeated param",
            ),
            OpenApiParameter(
                name="service_ids",
                required=False,
                type=OpenApiTypes.STR,
                description="Service UUIDs, comma-separated or repeated param",
            ),
            OpenApiParameter(
                name="client_ids",
                required=False,
                type=OpenApiTypes.STR,
                description="Client UUIDs, comma-separated or repeated param",
            ),
            OpenApiParameter(name="valid", required=False, type=OpenApiTypes.BOOL, description="Filter by valid flag"),
            OpenApiParameter(name="top", required=False, type=OpenApiTypes.INT, description="Top items limit (1-50)"),
        ],
        responses={200: CompanyStatisticsSerializer},
        operation_id="companies_statistics",
    )
    @action(detail=True, methods=["get"], url_path="statistics")
    def statistics(self, request, id=None):
        company = self.get_object()
        user = request.user
        self._ensure_company_access(user, company)

        filters = self._parse_statistics_filters(request)
        base_qs = self._statistics_base_queryset(company, user)

        if filters["valid"] is not None:
            base_qs = base_qs.filter(valid=filters["valid"])
        if filters["date_from"]:
            base_qs = base_qs.filter(date__date__gte=filters["date_from"])
        if filters["date_to"]:
            base_qs = base_qs.filter(date__date__lte=filters["date_to"])
        if filters["types"]:
            base_qs = base_qs.filter(type__in=filters["types"])
        if filters["methods"]:
            base_qs = base_qs.filter(method__in=filters["methods"])
        if filters["currencies"]:
            base_qs = base_qs.filter(currency__in=filters["currencies"])
        if filters["category_ids"]:
            base_qs = base_qs.filter(categories__id__in=filters["category_ids"])
        if filters["product_ids"]:
            base_qs = base_qs.filter(products__id__in=filters["product_ids"])
        if filters["service_ids"]:
            base_qs = base_qs.filter(services__id__in=filters["service_ids"])
        if filters["client_ids"]:
            base_qs = base_qs.filter(client_id__in=filters["client_ids"])

        base_qs = base_qs.distinct()
        tx_qs = Transaction.objects.filter(id__in=base_qs.values("id"))
        tx_ids = tx_qs.values("id")

        zero_decimal = Value(Decimal("0.00"), output_field=DecimalField(max_digits=18, decimal_places=2))
        summary_raw = tx_qs.aggregate(
            transactions_count=Count("id"),
            income_transactions_count=Count("id", filter=Q(type=Transaction.TYPE_INCOME)),
            outcome_transactions_count=Count("id", filter=Q(type=Transaction.TYPE_OUTCOME)),
            income_total=Coalesce(
                Sum("amount", filter=Q(type=Transaction.TYPE_INCOME)),
                zero_decimal,
            ),
            outcome_total=Coalesce(
                Sum("amount", filter=Q(type=Transaction.TYPE_OUTCOME)),
                zero_decimal,
            ),
            total_amount=Coalesce(Sum("amount"), zero_decimal),
            discount_total=Coalesce(Sum("discount_amount"), zero_decimal),
        )

        tx_count = summary_raw.get("transactions_count") or 0
        total_amount = summary_raw.get("total_amount") or Decimal("0.00")
        income_total = summary_raw.get("income_total") or Decimal("0.00")
        outcome_total = summary_raw.get("outcome_total") or Decimal("0.00")
        balance = income_total - outcome_total
        average_transaction = (
            (total_amount / Decimal(tx_count)).quantize(Decimal("0.01"))
            if tx_count
            else Decimal("0.00")
        )

        clients_with_transactions = (
            tx_qs.exclude(client_id__isnull=True).values("client_id").distinct().count()
        )
        products_units = TransactionProduct.objects.filter(transaction_id__in=tx_ids).count()
        services_units = TransactionService.objects.filter(transaction_id__in=tx_ids).count()

        categories_qs = (
            TransactionCategory.objects.filter(
                company=company,
                transactions__id__in=tx_ids,
            )
            .annotate(
                count=Count(
                    "transactions",
                    filter=Q(transactions__id__in=tx_ids),
                    distinct=True,
                ),
                amount=Coalesce(
                    Sum("transactions__amount", filter=Q(transactions__id__in=tx_ids)),
                    zero_decimal,
                ),
            )
            .order_by("-amount", "name")[: filters["top"]]
        )
        categories = [
            {
                "id": str(item.id),
                "name": item.name,
                "count": item.count,
                "amount": item.amount,
            }
            for item in categories_qs
        ]

        clients_qs = (
            Client.objects.filter(company=company, transactions__id__in=tx_ids)
            .annotate(
                count=Count(
                    "transactions",
                    filter=Q(transactions__id__in=tx_ids),
                    distinct=True,
                ),
                amount=Coalesce(
                    Sum("transactions__amount", filter=Q(transactions__id__in=tx_ids)),
                    zero_decimal,
                ),
            )
            .order_by("-amount", "name")[: filters["top"]]
        )
        clients = [
            {
                "id": str(item.id),
                "name": item.name,
                "count": item.count,
                "amount": item.amount,
            }
            for item in clients_qs
        ]

        products_qs = (
            Product.objects.filter(company=company, transaction_items__transaction__id__in=tx_ids)
            .annotate(
                transactions_count=Count(
                    "transaction_items__transaction",
                    filter=Q(transaction_items__transaction__id__in=tx_ids),
                    distinct=True,
                ),
                units=Count(
                    "transaction_items",
                    filter=Q(transaction_items__transaction__id__in=tx_ids),
                ),
            )
            .order_by("-units", "name")[: filters["top"]]
        )
        products = [
            {
                "id": str(item.id),
                "name": item.name,
                "transactions_count": item.transactions_count,
                "units": item.units,
            }
            for item in products_qs
        ]

        services_qs = (
            Service.objects.filter(company=company, transaction_items__transaction__id__in=tx_ids)
            .annotate(
                transactions_count=Count(
                    "transaction_items__transaction",
                    filter=Q(transaction_items__transaction__id__in=tx_ids),
                    distinct=True,
                ),
                units=Count(
                    "transaction_items",
                    filter=Q(transaction_items__transaction__id__in=tx_ids),
                ),
            )
            .order_by("-units", "name")[: filters["top"]]
        )
        services = [
            {
                "id": str(item.id),
                "name": item.name,
                "transactions_count": item.transactions_count,
                "units": item.units,
            }
            for item in services_qs
        ]

        group_by = filters["group_by"]
        trunc_fn = {
            self.STATS_GROUP_BY_DAY: TruncDay,
            self.STATS_GROUP_BY_WEEK: TruncWeek,
            self.STATS_GROUP_BY_MONTH: TruncMonth,
        }[group_by]
        trend_rows = (
            tx_qs.annotate(period=trunc_fn("date"))
            .values("period")
            .annotate(
                transactions_count=Count("id"),
                income=Coalesce(
                    Sum("amount", filter=Q(type=Transaction.TYPE_INCOME)),
                    zero_decimal,
                ),
                outcome=Coalesce(
                    Sum("amount", filter=Q(type=Transaction.TYPE_OUTCOME)),
                    zero_decimal,
                ),
            )
            .order_by("period")
        )
        trend = []
        for row in trend_rows:
            period = self._to_period_date(row.get("period"))
            if period is None:
                continue
            income = row.get("income") or Decimal("0.00")
            outcome = row.get("outcome") or Decimal("0.00")
            trend.append(
                {
                    "period": period,
                    "transactions_count": row.get("transactions_count", 0),
                    "income": income,
                    "outcome": outcome,
                    "balance": income - outcome,
                }
            )

        payload = {
            "filters": {
                "date_from": filters["date_from"],
                "date_to": filters["date_to"],
                "group_by": filters["group_by"],
                "types": filters["types"],
                "methods": filters["methods"],
                "currencies": filters["currencies"],
                "category_ids": filters["category_ids"],
                "product_ids": filters["product_ids"],
                "service_ids": filters["service_ids"],
                "client_ids": filters["client_ids"],
                "valid": filters["valid"],
                "top": filters["top"],
            },
            "summary": {
                "transactions_count": tx_count,
                "income_transactions_count": summary_raw.get("income_transactions_count", 0),
                "outcome_transactions_count": summary_raw.get("outcome_transactions_count", 0),
                "clients_with_transactions": clients_with_transactions,
                "products_units": products_units,
                "services_units": services_units,
                "income_total": income_total,
                "outcome_total": outcome_total,
                "total_amount": total_amount,
                "discount_total": summary_raw.get("discount_total") or Decimal("0.00"),
                "balance": balance,
                "average_transaction": average_transaction,
            },
            "trend": trend,
            "breakdowns": {
                "types": self._build_key_amount_breakdown(tx_qs, "type", self.STATS_TYPE_LABELS),
                "methods": self._build_key_amount_breakdown(tx_qs, "method", self.STATS_METHOD_LABELS),
                "currencies": self._build_key_amount_breakdown(tx_qs, "currency", self.STATS_CURRENCY_LABELS),
                "categories": categories,
                "clients": clients,
                "products": products,
                "services": services,
            },
        }

        return Response(CompanyStatisticsSerializer(payload).data, status=status.HTTP_200_OK)

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
