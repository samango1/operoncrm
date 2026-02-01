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
        CompanyMember = apps.get_model("crm", "CompanyMember")
        try:
            if CompanyMember.objects.filter(company=company, user=user).exists():
                return True
        except Exception:
            pass
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

        creator_id = getattr(obj, "created_by_id", None)
        if creator_id is not None and str(creator_id) == str(user.id):
            return True

        Company = apps.get_model("crm", "Company")
        if isinstance(obj, Company):
            return self._is_member_or_owner(user, obj)

        company = getattr(obj, "company", None)
        if getattr(obj, "valid", True) is False:
            if request.method == "DELETE":
                return self._is_member_or_owner(user, company)
            return company is not None and company.created_by_id == user.id

        return self._is_member_or_owner(user, company)


class CompanyAccessMixin:
    def _is_admin(self, user):
        return getattr(user, "is_admin", False)

    def _is_agent(self, user):
        return getattr(user, "is_agent", False)

    def _is_agent_owner_of_company(self, user, company):
        return bool(company and getattr(company, "created_by_id", None) == user.id)

    def _is_member_of_company(self, user, company):
        if not company or not user or not user.is_authenticated:
            return False

        CompanyMember = apps.get_model("crm", "CompanyMember")
        try:
            if CompanyMember.objects.filter(company=company, user=user).exists():
                return True
        except Exception:
            pass

        members = getattr(company, "members", None) or []
        uid = str(user.id)
        for m in members:
            if str(m.get("id")) == uid:
                return True
        return False

    def _user_companies_qs(self, user):
        Company = apps.get_model("crm", "Company")

        if not user or not user.is_authenticated:
            return Company.objects.none()

        CompanyMember = apps.get_model("crm", "CompanyMember")
        try:
            company_ids = CompanyMember.objects.filter(user=user).values_list("company_id", flat=True)
        except Exception:
            company_ids = []

        if company_ids:
            return Company.objects.filter(id__in=list(company_ids))

        matching = []
        for company in Company.objects.all():
            members = company.members or []
            for m in members:
                if str(m.get("id")) == str(user.id):
                    matching.append(company.id)
                    break
        if not matching:
            return Company.objects.none()
        return Company.objects.filter(id__in=matching)
