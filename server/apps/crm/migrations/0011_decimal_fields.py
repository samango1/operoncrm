import decimal

from django.core import validators
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("crm", "0010_fix_product_company_column"),
    ]

    operations = [
        migrations.AlterField(
            model_name="transaction",
            name="initial_amount",
            field=models.DecimalField(
                max_digits=18,
                decimal_places=2,
                validators=[validators.MinValueValidator(decimal.Decimal("0.01"))],
            ),
        ),
        migrations.AlterField(
            model_name="transaction",
            name="discount_amount",
            field=models.DecimalField(
                default=decimal.Decimal("0"),
                max_digits=18,
                decimal_places=2,
                validators=[validators.MinValueValidator(decimal.Decimal("0"))],
            ),
        ),
        migrations.AlterField(
            model_name="transaction",
            name="amount",
            field=models.DecimalField(
                editable=False,
                max_digits=18,
                decimal_places=2,
            ),
        ),
        migrations.AlterField(
            model_name="product",
            name="price",
            field=models.DecimalField(
                max_digits=18,
                decimal_places=2,
                validators=[validators.MinValueValidator(decimal.Decimal("0.01"))],
            ),
        ),
        migrations.AlterField(
            model_name="product",
            name="cost_price",
            field=models.DecimalField(
                null=True,
                blank=True,
                max_digits=18,
                decimal_places=2,
                validators=[validators.MinValueValidator(decimal.Decimal("0.01"))],
            ),
        ),
        migrations.AlterField(
            model_name="product",
            name="weight",
            field=models.DecimalField(
                null=True,
                blank=True,
                max_digits=12,
                decimal_places=3,
                validators=[validators.MinValueValidator(decimal.Decimal("0"))],
            ),
        ),
        migrations.AlterField(
            model_name="product",
            name="volume",
            field=models.DecimalField(
                null=True,
                blank=True,
                max_digits=12,
                decimal_places=3,
                validators=[validators.MinValueValidator(decimal.Decimal("0"))],
            ),
        ),
    ]
