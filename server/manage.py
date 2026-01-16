#!/usr/bin/env python
import os
import sys

from env_loader import DJANGO_SETTINGS_MODULE


def main():
    os.environ.setdefault(
        "DJANGO_SETTINGS_MODULE", DJANGO_SETTINGS_MODULE or "config.settings.dev"
    )
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError("Could not import Django.") from exc
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
