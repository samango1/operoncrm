from dataclasses import dataclass
from datetime import date
from uuid import UUID

from django.utils.dateparse import parse_date
from rest_framework.exceptions import ValidationError

from ..models import Transaction


@dataclass(frozen=True)
class CompanyStatisticsFilters:
    date_from: date | None
    date_to: date | None
    group_by: str
    types: list[str]
    methods: list[str]
    currencies: list[str]
    category_ids: list[str]
    product_ids: list[str]
    service_ids: list[str]
    client_ids: list[str]
    valid: bool | None
    top: int

    def as_payload(self):
        return {
            "date_from": self.date_from,
            "date_to": self.date_to,
            "group_by": self.group_by,
            "types": self.types,
            "methods": self.methods,
            "currencies": self.currencies,
            "category_ids": self.category_ids,
            "product_ids": self.product_ids,
            "service_ids": self.service_ids,
            "client_ids": self.client_ids,
            "valid": self.valid,
            "top": self.top,
        }


class CompanyStatisticsFiltersParser:
    GROUP_BY_DAY = "day"
    GROUP_BY_WEEK = "week"
    GROUP_BY_MONTH = "month"
    TOP_DEFAULT = 8
    TOP_MAX = 50

    @staticmethod
    def _split_param_values(request, name):
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

    @staticmethod
    def _parse_date_value(request, name):
        raw = request.query_params.get(name)
        if not raw:
            return None
        parsed = parse_date(raw)
        if parsed is None:
            raise ValidationError({name: "Use YYYY-MM-DD format."})
        return parsed

    @staticmethod
    def _parse_valid_value(request):
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

    def _parse_top_value(self, request):
        raw = request.query_params.get("top")
        if raw in (None, ""):
            return self.TOP_DEFAULT

        try:
            value = int(raw)
        except (TypeError, ValueError):
            raise ValidationError({"top": "top must be an integer."})

        if value < 1 or value > self.TOP_MAX:
            raise ValidationError({"top": f"top must be between 1 and {self.TOP_MAX}."})
        return value

    def parse(self, request):
        date_from = self._parse_date_value(request, "date_from")
        date_to = self._parse_date_value(request, "date_to")
        if date_from and date_to and date_from > date_to:
            raise ValidationError({"date_from": "date_from cannot be later than date_to."})

        group_by = request.query_params.get("group_by", self.GROUP_BY_DAY)
        if group_by not in (
            self.GROUP_BY_DAY,
            self.GROUP_BY_WEEK,
            self.GROUP_BY_MONTH,
        ):
            raise ValidationError({"group_by": "group_by must be day, week or month."})

        return CompanyStatisticsFilters(
            date_from=date_from,
            date_to=date_to,
            group_by=group_by,
            types=self._parse_choice_values(
                request,
                "types",
                {Transaction.TYPE_INCOME, Transaction.TYPE_OUTCOME},
            ),
            methods=self._parse_choice_values(
                request,
                "methods",
                {Transaction.METHOD_CASH, Transaction.METHOD_CARD},
            ),
            currencies=self._parse_choice_values(
                request,
                "currencies",
                {Transaction.CURRENCY_USD, Transaction.CURRENCY_UZS},
            ),
            category_ids=self._parse_uuid_values(request, "category_ids"),
            product_ids=self._parse_uuid_values(request, "product_ids"),
            service_ids=self._parse_uuid_values(request, "service_ids"),
            client_ids=self._parse_uuid_values(request, "client_ids"),
            valid=self._parse_valid_value(request),
            top=self._parse_top_value(request),
        )
