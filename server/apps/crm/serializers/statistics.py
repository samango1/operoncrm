from rest_framework import serializers


class CompanyStatisticsFiltersSerializer(serializers.Serializer):
    date_from = serializers.DateField(required=False, allow_null=True)
    date_to = serializers.DateField(required=False, allow_null=True)
    group_by = serializers.ChoiceField(choices=["day", "week", "month"])
    types = serializers.ListField(child=serializers.CharField(), required=False)
    methods = serializers.ListField(child=serializers.CharField(), required=False)
    currencies = serializers.ListField(child=serializers.CharField(), required=False)
    category_ids = serializers.ListField(child=serializers.CharField(), required=False)
    product_ids = serializers.ListField(child=serializers.CharField(), required=False)
    service_ids = serializers.ListField(child=serializers.CharField(), required=False)
    client_ids = serializers.ListField(child=serializers.CharField(), required=False)
    valid = serializers.BooleanField(required=False, allow_null=True)
    top = serializers.IntegerField(min_value=1, max_value=50)


class StatisticsKeyAmountItemSerializer(serializers.Serializer):
    key = serializers.CharField()
    label = serializers.CharField()
    count = serializers.IntegerField()
    amount = serializers.DecimalField(max_digits=18, decimal_places=2)


class StatisticsNamedAmountItemSerializer(serializers.Serializer):
    id = serializers.CharField()
    name = serializers.CharField()
    count = serializers.IntegerField()
    amount = serializers.DecimalField(max_digits=18, decimal_places=2)


class StatisticsNamedUnitsItemSerializer(serializers.Serializer):
    id = serializers.CharField()
    name = serializers.CharField()
    transactions_count = serializers.IntegerField()
    units = serializers.IntegerField()


class CompanyStatisticsSummarySerializer(serializers.Serializer):
    transactions_count = serializers.IntegerField()
    income_transactions_count = serializers.IntegerField()
    outcome_transactions_count = serializers.IntegerField()
    clients_with_transactions = serializers.IntegerField()
    products_units = serializers.IntegerField()
    services_units = serializers.IntegerField()
    income_total = serializers.DecimalField(max_digits=18, decimal_places=2)
    outcome_total = serializers.DecimalField(max_digits=18, decimal_places=2)
    total_amount = serializers.DecimalField(max_digits=18, decimal_places=2)
    discount_total = serializers.DecimalField(max_digits=18, decimal_places=2)
    balance = serializers.DecimalField(max_digits=18, decimal_places=2)
    average_transaction = serializers.DecimalField(max_digits=18, decimal_places=2)


class CompanyStatisticsTrendPointSerializer(serializers.Serializer):
    period = serializers.DateField()
    transactions_count = serializers.IntegerField()
    income = serializers.DecimalField(max_digits=18, decimal_places=2)
    outcome = serializers.DecimalField(max_digits=18, decimal_places=2)
    balance = serializers.DecimalField(max_digits=18, decimal_places=2)


class CompanyStatisticsBreakdownsSerializer(serializers.Serializer):
    types = StatisticsKeyAmountItemSerializer(many=True)
    methods = StatisticsKeyAmountItemSerializer(many=True)
    currencies = StatisticsKeyAmountItemSerializer(many=True)
    categories = StatisticsNamedAmountItemSerializer(many=True)
    clients = StatisticsNamedAmountItemSerializer(many=True)
    products = StatisticsNamedUnitsItemSerializer(many=True)
    services = StatisticsNamedUnitsItemSerializer(many=True)


class CompanyStatisticsSerializer(serializers.Serializer):
    filters = CompanyStatisticsFiltersSerializer()
    summary = CompanyStatisticsSummarySerializer()
    trend = CompanyStatisticsTrendPointSerializer(many=True)
    breakdowns = CompanyStatisticsBreakdownsSerializer()
