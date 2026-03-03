from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from ..serializers import CompanyStatisticsSerializer
from ..services import CompanyStatisticsFiltersParser, CompanyStatisticsService


class CompanyStatisticsMixin:
    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="id",
                location=OpenApiParameter.PATH,
                required=True,
                type=OpenApiTypes.UUID,
                description="Company id",
            ),
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

        filters = CompanyStatisticsFiltersParser().parse(request)
        include_invalid = self._is_admin(user) or self._is_agent_owner_of_company(user, company)
        payload = CompanyStatisticsService.build_payload(
            company=company,
            filters=filters,
            include_invalid=include_invalid,
        )

        return Response(CompanyStatisticsSerializer(payload).data, status=status.HTTP_200_OK)
