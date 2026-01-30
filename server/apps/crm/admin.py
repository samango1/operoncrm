from django.contrib import admin

from .models import Company, Transaction, Client, CompanyMember, TransactionCategory, Product

@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "slug", "plan", "created_by", "created_at")
    readonly_fields = ("id", "created_at", "updated_at")
    search_fields = ("name", "slug")

@admin.register(CompanyMember)
class CompanyMemberAdmin(admin.ModelAdmin):
    list_display = ("id", "company", "user", "telegram_id", "created_at")
    readonly_fields = ("id", "created_at")
    search_fields = ("company__name", "user__id", "user__username")

@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "type", "phone", "company", "valid", "created_at")
    readonly_fields = ("id", "created_at", "updated_at", "created_by")
    search_fields = ("name", "company__name", "company__slug")
    list_filter = ("type", "valid")

@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ("id", "company", "type", "method", "amount", "currency", "date", "valid", "created_at")
    readonly_fields = ("id", "amount", "created_at", "updated_at")
    search_fields = ("id", "company__name", "company__slug")
    list_filter = ("type", "method", "currency", "date", "valid")

@admin.register(TransactionCategory)
class TransactionCategoryAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "company", "created_by", "created_at")
    readonly_fields = ("id", "created_at", "updated_at")
    search_fields = ("name", "company__name", "company__slug")

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "company", "price", "currency", "active", "stock_quantity", "created_at")
    readonly_fields = ("id", "created_at", "updated_at")
    search_fields = ("name",)
    list_filter = ("currency", "active", "unit")
