#!/usr/bin/env python3
"""Inspect a Korean updater archive without extracting or executing its files."""
import gzip
import json
import os
import plistlib
import re
import stat
import struct
import sys
import tarfile
import unicodedata
from xml.parsers.expat import ExpatError

ROOT = "Buzz Korean.app"
IDENTIFIER = "io.github.ondallio.buzz-korean"
HELPERS = ("buzz-acp", "buzz-agent", "buzz-backend-kubernetes", "buzz-dev-mcp", "git-credential-nostr", "buzz")
ARM64 = 0x0100000C
MAX_COMPRESSED = 2 * 1024**3
MAX_EXPANDED = 4 * 1024**3
MAX_ENTRIES = 20000
MAX_METADATA = 1024**2
THIN = {b"\xce\xfa\xed\xfe": ("<", 28), b"\xcf\xfa\xed\xfe": ("<", 32), b"\xfe\xed\xfa\xce": (">", 28), b"\xfe\xed\xfa\xcf": (">", 32)}
FAT = {b"\xca\xfe\xba\xbe": (">", 20), b"\xbe\xba\xfe\xca": ("<", 20), b"\xca\xfe\xba\xbf": (">", 32), b"\xbf\xba\xfe\xca": ("<", 32)}


def require(condition, message):
    if not condition:
        raise ValueError(message)


class ExpandedReader:
    """Bound all gzip output, including padding and extended TAR metadata."""
    def __init__(self, source):
        self.source = source
        self.count = 0

    def read(self, size):
        require(size >= 0, "Unbounded archive read")
        data = self.source.read(min(size, MAX_EXPANDED - self.count + 1))
        self.count += len(data)
        require(self.count <= MAX_EXPANDED, "Expanded archive size limit exceeded")
        return data


class BoundedTarInfo(tarfile.TarInfo):
    @classmethod
    def fromtarfile(cls, archive):
        try:
            return super().fromtarfile(archive)
        except (tarfile.InvalidHeaderError, tarfile.EmptyHeaderError, tarfile.TruncatedHeaderError) as error:
            # TarFile.next otherwise treats later malformed headers as EOF.
            raise ValueError("Invalid or truncated TAR header/checksum") from error

    def _proc_member(self, archive):
        require(self.type != tarfile.GNUTYPE_SPARSE, "Unsupported GNU sparse header before parsing")
        # Intercept before tarfile allocates a complete PAX/long-name record.
        archive.buzz_header_count = getattr(archive, "buzz_header_count", 0) + 1
        require(archive.buzz_header_count <= MAX_ENTRIES, "Archive entry count limit exceeded")
        if self.type in (tarfile.XHDTYPE, tarfile.XGLTYPE, tarfile.SOLARIS_XHDTYPE, tarfile.GNUTYPE_LONGNAME, tarfile.GNUTYPE_LONGLINK):
            require(self.size <= MAX_METADATA, "TAR metadata size limit exceeded")
        return super()._proc_member(archive)

    def _proc_gnusparse_00(self, *args):
        raise ValueError("Unsupported PAX sparse 0.0 metadata before parsing")

    def _proc_gnusparse_01(self, *args):
        raise ValueError("Unsupported PAX sparse 0.1 metadata before parsing")

    def _proc_gnusparse_10(self, *args):
        raise ValueError("Unsupported PAX sparse 1.0 metadata before parsing")


def path_name(value):
    require(isinstance(value, str) and 0 < len(value) <= 4096, "Invalid archive path length")
    require("\\" not in value and "\0" not in value and not value.startswith("/"), "Absolute, NUL or backslash archive path")
    name = value.rstrip("/")
    parts = name.split("/")
    require(len(parts) <= 128, "Archive path depth limit exceeded")
    require(all(part not in ("", ".", "..") for part in parts), "Archive path traversal or empty component")
    require(parts[0] == ROOT, "Archive entry outside expected bundle envelope")
    return name


def thin_header(data, size):
    magic = bytes(data[:4])
    require(magic in THIN, "Invalid Mach-O slice header")
    endian, minimum = THIN[magic]
    require(len(data) >= minimum and size >= minimum, "Truncated Mach-O header")
    cpu, _, kind, commands, command_bytes = struct.unpack_from(endian + "IIIII", data, 4)
    require(cpu != ARM64 or minimum == 32, "ARM64 requires a 64-bit Mach-O header")
    require(command_bytes <= size - minimum and commands * 8 <= command_bytes, "Invalid Mach-O load-command header")
    return cpu, kind


def inspect_regular(stream, size, is_plist):
    require(not is_plist or size <= MAX_METADATA, "Info.plist size limit exceeded")
    prefix = stream.read(min(size, 4096))
    require(len(prefix) == min(size, 4096), "Truncated archive member")
    regions = []
    magic = prefix[:4]
    if magic in THIN:
        cpu, kind = thin_header(prefix, size)
        regions = [(0, size, cpu, bytearray(prefix[:32]))]
    elif magic in FAT:
        require(len(prefix) >= 8, "Truncated fat Mach-O header")
        endian, width = FAT[magic]
        count = struct.unpack_from(endian + "I", prefix, 4)[0]
        require(0 < count <= 64 and size >= 8 + count * width, "Invalid fat architecture count")
        for index in range(count):
            start = 8 + index * width
            cpu = struct.unpack_from(endian + "I", prefix, start)[0]
            offset, length = struct.unpack_from(endian + ("QQ" if width == 32 else "II"), prefix, start + 8)
            require(offset >= 8 + count * width and length >= 28 and offset + length <= size, "Invalid fat Mach-O slice bounds")
            regions.append((offset, length, cpu, bytearray(prefix[offset:min(offset + 32, len(prefix))])))
        regions.sort(key=lambda region: region[0])
        require(all(a[0] + a[1] <= b[0] for a, b in zip(regions, regions[1:])), "Overlapping fat Mach-O slices")
    retained = bytearray(prefix) if is_plist else None
    consumed = len(prefix)
    while consumed < size:
        data = stream.read(min(65536, size - consumed))
        require(data, "Truncated archive member body")
        if retained is not None:
            retained.extend(data)
        for offset, _, _, header in regions:
            lower, upper = max(consumed, offset), min(consumed + len(data), offset + 32)
            if lower < upper:
                header.extend(data[lower - consumed:upper - consumed])
        consumed += len(data)
    architectures = {}
    for offset, length, claimed_cpu, header in regions:
        cpu, kind = thin_header(header, length)
        require(cpu == claimed_cpu, "Fat Mach-O slice CPU architecture mismatch")
        require(cpu not in architectures or architectures[cpu] == kind, "Inconsistent fat Mach-O slice file type")
        architectures[cpu] = kind
    if regions:
        require(ARM64 in architectures, "Mach-O file lacks ARM64 architecture")
    return architectures, bytes(retained) if retained is not None else None


def verify_links(members):
    for name in members:
        parts = name.split("/")
        for index in range(1, len(parts)):
            parent = "/".join(parts[:index])
            # Exact listed parents prevent casefold/NFD aliases from becoming
            # implicit directories on the destination macOS filesystem.
            require(parent in members and members[parent]["kind"] == "dir", "Archive parent must be an explicit directory; symlink ancestors are forbidden")

    def resolve_link(name):
        target = members[name]["target"]
        require(target and len(target) <= 4096 and not target.startswith("/") and "\\" not in target and "\0" not in target, "Invalid absolute or backslash symlink target")
        pending = name.split("/")[:-1] + target.split("/")
        resolved, visited = [], set()
        while pending:
            part = pending.pop(0)
            if part in ("", "."):
                continue
            if part == "..":
                require(len(resolved) > 1, "Symlink escapes bundle envelope")
                resolved.pop()
                continue
            resolved.append(part)
            require(resolved[0] == ROOT, "Symlink outside expected bundle")
            current = "/".join(resolved)
            node = members.get(current)
            if node and node["kind"] == "symlink":
                require(current not in visited and len(visited) < 128, "Symlink cycle or chain limit exceeded")
                visited.add(current)
                next_target = node["target"]
                require(next_target and len(next_target) <= 4096 and not next_target.startswith("/") and "\\" not in next_target and "\0" not in next_target, "Invalid symlink target")
                resolved.pop()
                pending = next_target.split("/") + pending
            elif pending:
                require(node and node["kind"] == "dir", "Symlink has missing or non-directory ancestor")
        result = "/".join(resolved)
        require(result in members, "Dangling symlink target missing from bundle")

    for name, node in members.items():
        if node["kind"] == "symlink":
            resolve_link(name)


def verify_archive(filename, version):
    require(re.fullmatch(r"(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)", version) is not None, "Invalid release version")
    before = os.lstat(filename)
    require(stat.S_ISREG(before.st_mode) and 0 < before.st_size <= MAX_COMPRESSED, "Compressed archive file type or size limit exceeded")
    members, collisions = {}, set()
    plist_data, total = None, 0
    with open(filename, "rb") as compressed:
        opened = os.fstat(compressed.fileno())
        require((before.st_dev, before.st_ino, before.st_size) == (opened.st_dev, opened.st_ino, opened.st_size), "Archive changed while opening")
        with gzip.GzipFile(fileobj=compressed) as gzip_stream:
            bounded = ExpandedReader(gzip_stream)
            with tarfile.open(fileobj=bounded, mode="r|", bufsize=512, tarinfo=BoundedTarInfo) as archive:
                for member in archive:
                    require(not any(key.startswith("GNU.sparse.") for key in member.pax_headers), "Unsupported sparse PAX metadata")
                    name = path_name(member.name)
                    collision = unicodedata.normalize("NFD", name).casefold()
                    require(collision not in collisions, "Duplicate or macOS-colliding archive path")
                    collisions.add(collision)
                    require(member.size >= 0, "Invalid archive member size")
                    total += member.size
                    require(total <= MAX_EXPANDED, "Uncompressed member size limit exceeded")
                    node = {"mode": member.mode}
                    if member.isdir():
                        require(member.size == 0, "Directory has unexpected data")
                        require(member.mode & 0o500 == 0o500, "Directory lacks owner read/execute mode")
                        node["kind"] = "dir"
                    elif member.issym():
                        require(member.size == 0, "Symlink has unexpected data")
                        node.update(kind="symlink", target=member.linkname)
                    elif member.isreg():
                        require(member.sparse is None, "Unsupported sparse archive member")
                        require(member.mode & 0o400, "Regular file lacks owner read mode")
                        stream = archive.extractfile(member)
                        require(stream is not None, "Missing regular archive member")
                        architectures, info = inspect_regular(stream, member.size, name == f"{ROOT}/Contents/Info.plist")
                        node.update(kind="file", architectures=architectures)
                        if info is not None:
                            plist_data = info
                    else:
                        raise ValueError("Unsupported hardlink, device or special TAR entry type")
                    members[name] = node
                # Consume the remaining gzip stream and CRC, bounding padding too.
                while True:
                    padding = archive.fileobj.read(65536)
                    if not padding:
                        break
                    require(not any(padding), "Non-padding data follows TAR end marker")
        after = os.fstat(compressed.fileno())
        require((opened.st_size, opened.st_mtime_ns, opened.st_ctime_ns) == (after.st_size, after.st_mtime_ns, after.st_ctime_ns), "Archive changed during inspection")
    require(members, "Archive is empty")
    verify_links(members)
    require(plist_data is not None, "Missing Info.plist")
    info = plistlib.loads(plist_data)
    require(isinstance(info, dict) and info.get("CFBundleIdentifier") == IDENTIFIER, "Bundle identifier mismatch")
    require(info.get("CFBundleShortVersionString") == version, "Bundle version mismatch")
    executable = info.get("CFBundleExecutable")
    require(isinstance(executable, str) and re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}", executable) is not None, "Unsafe bundle executable name")
    for binary in (executable,) + HELPERS:
        node = members.get(f"{ROOT}/Contents/MacOS/{binary}")
        require(node is not None and node["kind"] == "file", f"Missing regular executable sidecar: {binary}")
        require(node["mode"] & 0o100, f"Sidecar lacks owner executable mode: {binary}")
        require(node["architectures"].get(ARM64) == 2, f"Expected ARM64 Mach-O executable: {binary}")
    return {"bundle": ROOT, "version": version, "entries": len(members), "executables": 7, "uncompressedBytes": total}


if __name__ == "__main__":
    try:
        require(len(sys.argv) == 3, "Usage: verify-archive.py ARCHIVE VERSION")
        print(json.dumps(verify_archive(sys.argv[1], sys.argv[2]), separators=(",", ":")))
    except (ValueError, OSError, EOFError, tarfile.TarError, plistlib.InvalidFileException, ExpatError, struct.error) as error:
        print(f"Archive rejected: {error}", file=sys.stderr)
        sys.exit(1)
