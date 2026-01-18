from django.contrib import admin

from .models import Company, Transaction

@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "slug", "plan", "created_by", "created_at")
    readonly_fields = ("id", "created_at", "updated_at")
    search_fields = ("name", "slug")

@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ("id", "company", "type", "method", "amount", "currency", "date", "invalid", "created_at")
    readonly_fields = ("id", "amount", "created_at", "updated_at")
    search_fields = ("id", "company__name", "company__slug")
    list_filter = ("type", "method", "currency", "date", "invalid")