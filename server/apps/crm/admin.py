from django.contrib import admin

from .models import Company


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "slug", "plan", "created_by", "created_at")
    readonly_fields = ("id", "created_at", "updated_at")
    search_fields = ("name", "slug")
