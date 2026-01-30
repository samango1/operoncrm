import django.db.models.deletion
from django.db import migrations, models


def _column_exists(schema_editor, table_name: str, column_name: str) -> bool:
    with schema_editor.connection.cursor() as cursor:
        description = schema_editor.connection.introspection.get_table_description(cursor, table_name)
    return any(getattr(col, "name", None) == column_name for col in description)


def add_company_column(apps, schema_editor):
    table = "crm_product"
    column = "company_id"
    if _column_exists(schema_editor, table, column):
        return

    Product = apps.get_model("crm", "Product")
    Company = apps.get_model("crm", "Company")
    field = models.ForeignKey(
        Company,
        on_delete=django.db.models.deletion.CASCADE,
        related_name="products",
        null=True,
        blank=True,
    )
    field.set_attributes_from_name("company")
    schema_editor.add_field(Product, field)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("crm", "0009_transaction_products"),
    ]

    operations = [
        migrations.RunPython(add_company_column, reverse_code=noop_reverse),
    ]
