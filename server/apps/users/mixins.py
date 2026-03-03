from typing import Iterable, List, Optional, Set, Tuple

from django.db.models import (
    BigIntegerField,
    CharField,
    EmailField,
    IntegerField,
    Q,
    QuerySet,
    SlugField,
    TextField,
)

CANDIDATE_FIELD_TYPES = (
    CharField,
    TextField,
    SlugField,
    EmailField,
    IntegerField,
    BigIntegerField,
)

TEXT_FIELD_TYPES = (CharField, TextField, SlugField, EmailField)
NUMERIC_FIELD_TYPES = (IntegerField, BigIntegerField)
BOOL_TRUE_VALUES = {"1", "true", "yes", "on"}
BOOL_FALSE_VALUES = {"0", "false", "no", "off"}


class CreatedByMixin:
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class RoleQuerysetMixin:
    def filter_queryset_by_role(self, queryset: QuerySet) -> QuerySet:
        user = self.request.user
        if user.is_admin:
            return queryset
        if user.is_agent:
            return queryset.filter(created_by=user)
        return queryset.none()


def parse_bool_query_param(raw) -> Optional[bool]:
    if raw is None:
        return None
    if isinstance(raw, bool):
        return raw
    normalized = str(raw).strip().lower()
    if normalized in BOOL_TRUE_VALUES:
        return True
    if normalized in BOOL_FALSE_VALUES:
        return False
    return None


class DeepQueryMixin:
    deep_shallow_actions = ("list",)
    deep_shallow_get_actions = ()

    def _parse_deep_param(self) -> Optional[bool]:
        request = getattr(self, "request", None)
        if request is None:
            return None
        return parse_bool_query_param(request.query_params.get("deep"))

    def _default_deep_for_request(self) -> bool:
        action = getattr(self, "action", None)
        method = getattr(getattr(self, "request", None), "method", "").upper()

        if action in set(self.deep_shallow_actions):
            return False
        if method == "GET" and action in set(self.deep_shallow_get_actions):
            return False
        return True

    def _deep_requested(self) -> bool:
        deep = self._parse_deep_param()
        if deep is not None:
            return deep
        return self._default_deep_for_request()

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["deep"] = self._deep_requested()
        return context


def _normalize_for_search(s: Optional[str]) -> str:
    if s is None:
        return ""
    s = str(s).lower()
    return "".join(ch for ch in s if ch.isalnum())


def _ngrams(s: str, n: int = 3) -> List[str]:
    s = _normalize_for_search(s)
    if not s:
        return []
    if len(s) < n:
        return [s]
    return [s[i : i + n] for i in range(len(s) - n + 1)]


def _detect_search_fields(
    model,
    provided_search_fields: Optional[Iterable[str]],
) -> Tuple[List[str], List[str], List[str]]:
    if provided_search_fields is None:
        detected = [
            f
            for f in model._meta.get_fields()
            if getattr(f, "concrete", False) and isinstance(f, CANDIDATE_FIELD_TYPES)
        ]
        text_fields = [f.name for f in detected if isinstance(f, TEXT_FIELD_TYPES)]
        numeric_fields = [
            f.name for f in detected if isinstance(f, NUMERIC_FIELD_TYPES)
        ]
        all_fields = text_fields + numeric_fields
    else:
        all_fields = list(provided_search_fields)
        text_fields = all_fields[:]
        numeric_fields = []
    return text_fields, numeric_fields, all_fields


def _apply_short_query_filter(
    queryset: QuerySet,
    q_norm: str,
    text_fields: List[str],
    numeric_fields: List[str],
) -> Optional[QuerySet]:
    cond = Q()
    added = False

    for field in text_fields:
        cond |= Q(**{f"{field}__icontains": q_norm})
        added = True

    if any(ch.isdigit() for ch in q_norm):
        if q_norm.isdigit():
            num_value = int(q_norm)
            for field in numeric_fields:
                cond |= Q(**{field: num_value})
                added = True

    if not added:
        return None

    return queryset.filter(cond)


def _apply_ngram_search(
    queryset: QuerySet,
    model,
    q_norm: str,
    search_fields: List[str],
    numeric_fields: List[str],
    ngram_size: int,
    threshold: float,
) -> Optional[QuerySet]:
    query_ngrams: Set[str] = set(_ngrams(q_norm, ngram_size))
    if not query_ngrams:
        return None

    pk_name = model._meta.pk.name
    vals_qs = queryset.values_list(pk_name, *search_fields)

    matching_pks = []

    for row in vals_qs:
        pk = row[0]
        field_values = row[1:]

        matched = False
        for idx, val in enumerate(field_values):
            if val is None:
                continue

            field_name = search_fields[idx]
            val_str = str(val)

            if field_name in numeric_fields:
                if q_norm in _normalize_for_search(val_str):
                    matched = True
                    break
                else:
                    continue

            db_ngrams = _ngrams(val_str, ngram_size)
            if not db_ngrams:
                continue

            overlap = len(set(db_ngrams) & query_ngrams)
            similarity = overlap / len(db_ngrams)

            if similarity > threshold:
                matched = True
                break

        if matched:
            matching_pks.append(pk)

    if not matching_pks:
        return None

    return queryset.filter(pk__in=matching_pks)


def apply_search_filter(
    queryset: QuerySet,
    request,
    *,
    ngram_size: int = 3,
    threshold: float = 0.5,
    search_fields: Optional[Iterable[str]] = None,
) -> QuerySet:
    q = request.query_params.get("search")
    if not q:
        return queryset

    q_norm = _normalize_for_search(q)
    if not q_norm:
        return queryset

    model = getattr(queryset, "model", None)
    if model is None:
        return queryset

    text_fields, numeric_fields, all_search_fields = _detect_search_fields(
        model, search_fields
    )

    if not all_search_fields:
        return queryset.none()

    if len(q_norm) <= ngram_size:
        short_qs = _apply_short_query_filter(
            queryset, q_norm, text_fields, numeric_fields
        )
        if short_qs is None:
            return queryset.none()
        return short_qs

    ng_qs = _apply_ngram_search(
        queryset=queryset,
        model=model,
        q_norm=q_norm,
        search_fields=all_search_fields,
        numeric_fields=numeric_fields,
        ngram_size=ngram_size,
        threshold=threshold,
    )
    if ng_qs is None:
        return queryset.none()
    return ng_qs
