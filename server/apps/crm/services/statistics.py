from decimal import Decimal

from django.db.models import Count, DecimalField, Q, Sum, Value
from django.db.models.functions import Coalesce, TruncDay, TruncMonth, TruncWeek

from ..models import (
    Client,
    Product,
    Service,
    Transaction,
    TransactionCategory,
    TransactionProduct,
    TransactionService,
)


class CompanyStatisticsService:
    TYPE_LABELS = {
        Transaction.TYPE_INCOME: "Income",
        Transaction.TYPE_OUTCOME: "Outcome",
    }
    METHOD_LABELS = {
        Transaction.METHOD_CASH: "Cash",
        Transaction.METHOD_CARD: "Card",
    }
    CURRENCY_LABELS = {
        Transaction.CURRENCY_UZS: "UZS",
        Transaction.CURRENCY_USD: "USD",
    }

    @staticmethod
    def _to_period_date(value):
        if value is None:
            return None
        if hasattr(value, "date"):
            return value.date()
        return value

    @staticmethod
    def _build_key_amount_breakdown(qs, group_field, label_map):
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

    @classmethod
    def _statistics_base_queryset(cls, company, include_invalid):
        qs = Transaction.objects.filter(company=company)
        if not include_invalid:
            qs = qs.filter(valid=True)
        return qs

    @classmethod
    def build_payload(cls, *, company, filters, include_invalid=False):
        base_qs = cls._statistics_base_queryset(company, include_invalid)

        if filters.valid is not None:
            base_qs = base_qs.filter(valid=filters.valid)
        if filters.date_from:
            base_qs = base_qs.filter(date__date__gte=filters.date_from)
        if filters.date_to:
            base_qs = base_qs.filter(date__date__lte=filters.date_to)
        if filters.types:
            base_qs = base_qs.filter(type__in=filters.types)
        if filters.methods:
            base_qs = base_qs.filter(method__in=filters.methods)
        if filters.currencies:
            base_qs = base_qs.filter(currency__in=filters.currencies)
        if filters.category_ids:
            base_qs = base_qs.filter(categories__id__in=filters.category_ids)
        if filters.product_ids:
            base_qs = base_qs.filter(products__id__in=filters.product_ids)
        if filters.service_ids:
            base_qs = base_qs.filter(services__id__in=filters.service_ids)
        if filters.client_ids:
            base_qs = base_qs.filter(client_id__in=filters.client_ids)

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
            .order_by("-amount", "name")[: filters.top]
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
            .order_by("-amount", "name")[: filters.top]
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
            .order_by("-units", "name")[: filters.top]
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
            .order_by("-units", "name")[: filters.top]
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

        trunc_fn = {
            "day": TruncDay,
            "week": TruncWeek,
            "month": TruncMonth,
        }[filters.group_by]
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
            period = cls._to_period_date(row.get("period"))
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

        return {
            "filters": filters.as_payload(),
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
                "types": cls._build_key_amount_breakdown(tx_qs, "type", cls.TYPE_LABELS),
                "methods": cls._build_key_amount_breakdown(tx_qs, "method", cls.METHOD_LABELS),
                "currencies": cls._build_key_amount_breakdown(tx_qs, "currency", cls.CURRENCY_LABELS),
                "categories": categories,
                "clients": clients,
                "products": products,
                "services": services,
            },
        }
