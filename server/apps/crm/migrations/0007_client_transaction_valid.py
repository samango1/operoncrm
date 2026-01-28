from django.db import migrations, models


def copy_invalid_to_valid(apps, schema_editor):
    Client = apps.get_model("crm", "Client")
    Transaction = apps.get_model("crm", "Transaction")

    Client.objects.update(valid=~models.F("invalid"))
    Transaction.objects.update(valid=~models.F("invalid"))


def copy_valid_to_invalid(apps, schema_editor):
    Client = apps.get_model("crm", "Client")
    Transaction = apps.get_model("crm", "Transaction")

    Client.objects.update(invalid=~models.F("valid"))
    Transaction.objects.update(invalid=~models.F("valid"))


class Migration(migrations.Migration):
    dependencies = [
        ("crm", "0006_transactioncategory_transaction_categories"),
    ]

    operations = [
        migrations.AddField(
            model_name="client",
            name="valid",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="transaction",
            name="valid",
            field=models.BooleanField(default=True),
        ),
        migrations.RunPython(copy_invalid_to_valid, copy_valid_to_invalid),
        migrations.RemoveField(
            model_name="client",
            name="invalid",
        ),
        migrations.RemoveField(
            model_name="transaction",
            name="invalid",
        ),
    ]
