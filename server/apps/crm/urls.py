from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import CompanyViewSet, TransactionViewSet, ClientViewSet, TransactionCategoryViewSet

router = DefaultRouter()
router.register(r"companies", CompanyViewSet, basename="company")
router.register(r"transactions", TransactionViewSet, basename="transaction")
router.register(r"clients", ClientViewSet, basename="client")
router.register(r"transaction-categories", TransactionCategoryViewSet, basename="transaction-category")

urlpatterns = [
    path("", include(router.urls)),
]
