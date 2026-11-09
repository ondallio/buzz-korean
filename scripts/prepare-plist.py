"""Preserve upstream permission declarations and set permanent channel names."""
import plistlib
import sys

with open(sys.argv[1], "rb") as source:
    plist = plistlib.load(source)
plist["CFBundleName"] = "Buzz Korean"
plist["CFBundleDisplayName"] = "Buzz Korean"
with open(sys.argv[2], "wb") as output:
    plistlib.dump(plist, output)
