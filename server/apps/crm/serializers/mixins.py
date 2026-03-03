def is_deep_context(context):
    deep = context.get("deep") if isinstance(context, dict) else None
    if isinstance(deep, bool):
        return deep
    if isinstance(deep, str):
        normalized = deep.strip().lower()
        if normalized in {"1", "true", "yes", "on"}:
            return True
        if normalized in {"0", "false", "no", "off"}:
            return False
    return True


class RepresentationMixin:
    def _is_deep(self):
        return is_deep_context(self.context)

    def _is_read_request(self):
        request = self.context.get("request")
        if not request:
            return False
        return request.method in ("GET", "HEAD", "OPTIONS")

    def _set_uuid_id(self, ret, instance):
        ret["id"] = str(instance.id)

    def _minimal_representation(self, instance, *, fields):
        data = {}
        for field in fields:
            if field == "id":
                data["id"] = str(getattr(instance, "id"))
                continue
            data[field] = getattr(instance, field, None)
        return data

    def _ensure_nested_data(self, ret, *, field_name, instance_obj, serializer_cls):
        if not instance_obj:
            return None

        field_data = ret.get(field_name)
        if not field_data:
            ret[field_name] = serializer_cls(instance_obj, context=self.context).data
            field_data = ret[field_name]

        if isinstance(field_data, dict) and getattr(instance_obj, "id", None) is not None:
            field_data["id"] = str(instance_obj.id)

        return field_data
