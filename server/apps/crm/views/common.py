from django.core.exceptions import FieldDoesNotExist
from django.shortcuts import get_object_or_404
from apps.users.mixins import DeepQueryMixin, apply_search_filter, parse_bool_query_param
from apps.users.permissions import CompanyAccessMixin
from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema
from rest_framework import status, viewsets
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication

from ..models import Client, Company, Product, Service, Transaction, TransactionCategory
from ..services import TransactionWriteService


class CompanyAccessMixinLocal(CompanyAccessMixin):
    def _get_valid_param(self, request):
        return parse_bool_query_param(request.query_params.get("valid"))

    def _serializer_context(self, request):
        deep_value = self._deep_requested() if hasattr(self, "_deep_requested") else True
        return {
            "request": request,
            "deep": deep_value,
        }

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
            except (Company.DoesNotExist, ValueError, TypeError):
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
                serializer = serializer_class(page, many=True, context=self._serializer_context(request))
                return self.get_paginated_response(serializer.data)
            serializer = serializer_class(qs, many=True, context=self._serializer_context(request))
            return Response(serializer.data, status=status.HTTP_200_OK)

        serializer = serializer_class(data=request.data, context=self._serializer_context(request))
        serializer.is_valid(raise_exception=True)
        save_kwargs = {"company": company}
        if "created_by" in getattr(serializer, "fields", {}):
            save_kwargs["created_by"] = user

        if rel_name == "transactions":
            validated_data = dict(serializer.validated_data)
            validated_data.update(save_kwargs)
            instance = TransactionWriteService.create(validated_data=validated_data)
            out = serializer_class(instance, context=self._serializer_context(request))
            return Response(out.data, status=status.HTTP_201_CREATED)

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
            serializer = serializer_class(instance, context=self._serializer_context(request))
            return Response(serializer.data, status=status.HTTP_200_OK)

        if request.method in ("PATCH", "PUT"):
            partial = request.method == "PATCH"
            actor = user
            new_company_raw = request.data.get("company")

            self._validate_company_change(actor, company, new_company_raw)

            serializer = serializer_class(
                instance,
                data=request.data,
                partial=partial,
                context=self._serializer_context(request),
            )
            serializer.is_valid(raise_exception=True)

            if not (self._is_admin(actor) or self._is_agent(actor)):
                serializer.validated_data.pop("company", None)
            if model is Transaction:
                updated = TransactionWriteService.update(
                    instance=instance,
                    validated_data=serializer.validated_data,
                )
                out = serializer_class(updated, context=self._serializer_context(request))
                return Response(out.data, status=status.HTTP_200_OK)

            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)

        if request.method == "DELETE":
            if not (self._is_admin(user) or self._is_agent_owner_of_company(user, company) or self._is_member_of_company(user, company)):
                raise PermissionDenied("You do not have permission to delete this resource.")
            instance.soft_delete()
            return Response(status=status.HTTP_204_NO_CONTENT)


class BaseCompanyScopedViewSet(DeepQueryMixin, CompanyAccessMixinLocal, viewsets.ModelViewSet):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    lookup_field = "id"

    model = None
    select_related_fields = ()
    prefetch_related_fields = ()
    member_valid_only = False
    allow_valid_param_filter = False
    search_fields = None
    search_ngram_size = 3
    search_threshold = 0.5

    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="search",
                location=OpenApiParameter.QUERY,
                required=False,
                type=OpenApiTypes.STR,
                description="Fuzzy search query.",
            ),
            OpenApiParameter(
                name="valid",
                location=OpenApiParameter.QUERY,
                required=False,
                type=OpenApiTypes.BOOL,
                description="Filter by soft-delete flag when supported by resource.",
            ),
            OpenApiParameter(
                name="deep",
                location=OpenApiParameter.QUERY,
                required=False,
                type=OpenApiTypes.BOOL,
                description="Include expanded nested objects. Default: false for list.",
            ),
        ]
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="deep",
                location=OpenApiParameter.QUERY,
                required=False,
                type=OpenApiTypes.BOOL,
                description="Include expanded nested objects. Default: true for detail.",
            ),
        ]
    )
    def retrieve(self, request, *args, **kwargs):
        return super().retrieve(request, *args, **kwargs)

    def _get_model(self):
        if self.model is not None:
            return self.model
        queryset = getattr(self, "queryset", None)
        if queryset is not None and hasattr(queryset, "model"):
            return queryset.model
        raise RuntimeError("BaseCompanyScopedViewSet requires `model` or `queryset`.")

    def _base_queryset(self):
        model = self._get_model()
        qs = model.objects.all()
        if self.select_related_fields:
            qs = qs.select_related(*self.select_related_fields)
        if self.prefetch_related_fields:
            qs = qs.prefetch_related(*self.prefetch_related_fields)
        return qs

    def _apply_role_scope(self, qs, user):
        model = self._get_model()
        if self._is_admin(user):
            return qs
        if self._is_agent(user):
            return qs.filter(company__created_by=user)

        company_ids = list(self._user_companies_qs(user).values_list("id", flat=True))
        if not company_ids:
            return model.objects.none()

        qs = qs.filter(company_id__in=company_ids)
        if self.member_valid_only:
            qs = qs.filter(valid=True)
        return qs

    def _post_search_queryset(self, role_qs, searched_qs):
        return searched_qs

    def get_queryset(self):
        user = self.request.user
        model = self._get_model()
        if not user or not user.is_authenticated:
            return model.objects.none()

        role_qs = self._apply_role_scope(self._base_queryset(), user)
        qs = role_qs
        if self.allow_valid_param_filter:
            qs = self._apply_valid_filter(qs, self.request)
        qs = apply_search_filter(
            qs,
            self.request,
            ngram_size=self.search_ngram_size,
            threshold=self.search_threshold,
            search_fields=self.search_fields,
        )
        return self._post_search_queryset(role_qs, qs)

    def get_object(self):
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        obj_id = self.kwargs.get(lookup_url_kwarg)
        instance = get_object_or_404(self._base_queryset(), pk=obj_id)
        company = getattr(instance, "company", None)
        if company is not None:
            self._ensure_company_access(self.request.user, company)
        self.check_object_permissions(self.request, instance)
        return instance
