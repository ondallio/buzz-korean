"""Preserve English base metadata; optionally emit validated macOS localizations."""
import json
import os
from pathlib import Path
import plistlib
import sys
import tempfile

USAGE_KEYS = {
    "NSMicrophoneUsageDescription",
    "NSCameraUsageDescription",
    "NSLocalNetworkUsageDescription",
}
CATALOGS = Path(__file__).resolve().parent.parent / "locales"


def permission_localizations(info):
    """Reject upstream/catalog drift before creating any output files."""
    source_keys = {key for key in info if key.startswith("NS") and key.endswith("UsageDescription")}
    if source_keys != USAGE_KEYS:
        raise ValueError("Source permission key set differs from the three reviewed usage descriptions")
    values = {}
    for locale in ("en", "ko"):
        with (CATALOGS / f"macos.{locale}.json").open(encoding="utf-8") as stream:
            catalog = json.load(stream)
        if not isinstance(catalog, dict) or set(catalog) != USAGE_KEYS:
            raise ValueError(f"{locale} permission catalog has missing or unexpected keys")
        if any(not isinstance(value, str) or not value.strip() for value in catalog.values()):
            raise ValueError(f"{locale} permission catalog contains an empty or invalid sentence")
        values[locale] = catalog
    for key in USAGE_KEYS:
        if info[key] != values["en"][key]:
            raise ValueError(f"Upstream English permission sentence changed: {key}")
    return values


def write_atomic(destination, data):
    """Replace one complete public metadata file without exposing partial bytes."""
    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=destination.parent, delete=False) as stream:
            temporary = Path(stream.name)
            os.fchmod(stream.fileno(), 0o644)
            stream.write(data)
        os.replace(temporary, destination)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def prepare(source, destination, resources=None):
    """Prepare permanent channel names and optional en/ko permission resources."""
    with open(source, "rb") as stream:
        info = plistlib.load(stream)
    if not isinstance(info, dict):
        raise ValueError("Source Info.plist must be a dictionary")
    catalogs = permission_localizations(info) if resources is not None else None
    info["CFBundleName"] = "Buzz Korean"
    info["CFBundleDisplayName"] = "Buzz Korean"
    if catalogs is not None:
        info["CFBundleDevelopmentRegion"] = "en"
        info["CFBundleLocalizations"] = ["en", "ko"]
    base = plistlib.dumps(info)
    localized = {
        locale: plistlib.dumps(values, fmt=plistlib.FMT_BINARY)
        for locale, values in (catalogs or {}).items()
    }
    for locale, data in localized.items():
        write_atomic(Path(resources) / f"{locale}.lproj" / "InfoPlist.strings", data)
    write_atomic(destination, base)


if __name__ == "__main__":
    try:
        if len(sys.argv) not in (3, 4):
            raise ValueError("Usage: prepare-plist.py SOURCE DESTINATION [LOCALIZATIONS_DIR]")
        prepare(*sys.argv[1:])
    except (ValueError, OSError, plistlib.InvalidFileException) as error:
        print(f"macOS metadata preparation failed: {error}", file=sys.stderr)
        sys.exit(1)
