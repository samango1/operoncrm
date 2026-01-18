from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import CompanyViewSet, TransactionViewSet

router = DefaultRouter()
router.register(r"companies", CompanyViewSet, basename="company")
router.register(r"transactions", TransactionViewSet, basename="transaction")

urlpatterns = [
    path("", include(router.urls)),
]
