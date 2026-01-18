from rest_framework.permissions import BasePermission
from django.apps import apps


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated and request.user.is_admin
        )


class IsAgent(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated and request.user.is_agent
        )


class IsAdminOrAgent(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and (user.is_admin or user.is_agent))


class IsCreatorOrAdmin(BasePermission):
    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_admin:
            return True
        return getattr(obj, "created_by_id", None) == user.id


class IsMemberOrCreatedBy(BasePermission):
    def _is_member_or_owner(self, user, company):
        if not company:
            return False
        if getattr(user, "is_admin", False):
            return True
        if company.created_by_id == user.id:
            return True
        members = company.members or []
        user_id_str = str(user.id)
        for m in members:
            if str(m.get("id")) == user_id_str:
                return True
        return False

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        if getattr(user, "is_admin", False):
            return True

        if view.action == "create":
            company_id = request.data.get("company_id") or request.data.get("company")
            if not company_id:
                return False
            Company = apps.get_model("crm", "Company")
            try:
                company = Company.objects.get(id=company_id)
            except Company.DoesNotExist:
                return False

            if getattr(user, "is_agent", False) and company.created_by_id == user.id:
                return True

            return self._is_member_or_owner(user, company)

        return True

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        if getattr(user, "is_admin", False):
            return True

        Company = apps.get_model("crm", "Company")
        if isinstance(obj, Company):
            return self._is_member_or_owner(user, obj)

        company = getattr(obj, "company", None)
        if getattr(obj, "invalid", False):
            return company is not None and company.created_by_id == user.id

        return self._is_member_or_owner(user, company)