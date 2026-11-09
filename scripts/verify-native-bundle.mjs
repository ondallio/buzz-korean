import { createHash } from "node:crypto";
import { constants } from "node:fs";
import {
	chmod,
	lstat,
	mkdir,
	mkdtemp,
	open,
	opendir,
	readlink,
	realpath,
	rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { run } from "./process.mjs";
import { parseVersion } from "./release-policy.mjs";

const BUNDLE = "Buzz Korean.app";
const MAX_FILE = 2 * 1024 ** 3;
const MAX_TREE = 4 * 1024 ** 3;
const MAX_ENTRIES = 20_000;
const MAX_METADATA = 1024 ** 2;
const CHUNK_SIZE = 64 * 1024;
const ARCHIVE_GATE = fileURLToPath(
	new URL("./verify-archive.py", import.meta.url),
);
const SECRET_VARIABLES = [
	"TAURI_SIGNING_PRIVATE_KEY",
	"TAURI_SIGNING_PRIVATE_KEY_PASSWORD",
	"KOREAN_UPDATER_PRIVATE_KEY",
	"GH_TOKEN",
	"GITHUB_TOKEN",
];
const PLIST_JSON =
	"import sys,plistlib,json; data=sys.stdin.buffer.read(1048577); assert len(data)<=1048576; print(json.dumps(plistlib.loads(data)))";

/** Native verification failed; retained privateDirectory requires explicit cleanup after safe detachment. */
export class NativeBundleError extends Error {
	constructor(code, message, details = {}) {
		super(
			message,
			details.cause === undefined ? undefined : { cause: details.cause },
		);
		this.name = "NativeBundleError";
		this.code = code;
		Object.assign(this, details);
	}
}
function requireValue(value, code, message) {
	if (!value) throw new NativeBundleError(code, message);
}
async function tool(command, args, code, options = {}) {
	try {
		return await run(command, args, {
			timeoutMs: 120_000,
			maxBytes: MAX_METADATA,
			...options,
		});
	} catch (cause) {
		throw new NativeBundleError(
			code,
			`Native verification tool failed: ${command}.`,
			{ cause },
		);
	}
}
function unchanged(before, after) {
	return ["dev", "ino", "size", "mode", "mtimeNs", "ctimeNs"].every(
		(key) => before[key] === after[key],
	);
}
async function streamFile(handle, expected, consume) {
	const buffer = Buffer.allocUnsafe(CHUNK_SIZE);
	let position = 0;
	while (true) {
		const { bytesRead } = await handle.read(buffer, 0, buffer.length, position);
		if (!bytesRead) break;
		position += bytesRead;
		requireValue(
			position <= expected && position <= MAX_FILE,
			"BUNDLE_SIZE_LIMIT",
			"File changed or exceeded its bounded size while reading.",
		);
		await consume(buffer.subarray(0, bytesRead), position - bytesRead);
	}
	requireValue(
		position === expected,
		"BUNDLE_CHANGED",
		"File size changed while reading.",
	);
}
async function pinInput(source, destination) {
	const input = await open(
		resolve(source),
		constants.O_RDONLY | constants.O_NOFOLLOW,
	);
	try {
		const before = await input.stat({ bigint: true });
		requireValue(
			before.isFile() && before.size > 0n && before.size <= BigInt(MAX_FILE),
			"INPUT_SIZE_LIMIT",
			"Native artifact must be a nonempty regular file no larger than 2 GiB.",
		);
		const output = await open(destination, "wx", 0o600);
		try {
			await streamFile(input, Number(before.size), async (data, position) => {
				let written = 0;
				while (written < data.length) {
					const result = await output.write(
						data,
						written,
						data.length - written,
						position + written,
					);
					requireValue(
						result.bytesWritten > 0,
						"ARTIFACT_COPY_FAILED",
						"Could not complete private artifact copy.",
					);
					written += result.bytesWritten;
				}
			});
			requireValue(
				unchanged(before, await input.stat({ bigint: true })),
				"ARTIFACT_CHANGED",
				"Artifact changed during private copy.",
			);
		} finally {
			await output.close();
		}
	} finally {
		await input.close();
	}
}
async function readMetadata(file) {
	const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
	try {
		const before = await handle.stat({ bigint: true });
		requireValue(
			before.isFile() && before.size <= BigInt(MAX_METADATA),
			"INVALID_METADATA",
			"Bundle metadata must be a bounded regular file.",
		);
		const data = await handle.readFile();
		requireValue(
			data.length <= MAX_METADATA &&
				unchanged(before, await handle.stat({ bigint: true })),
			"BUNDLE_CHANGED",
			"Bundle metadata changed during inspection.",
		);
		return data;
	} finally {
		await handle.close();
	}
}
async function plist(data) {
	const text = await tool("python3", ["-c", PLIST_JSON], "INVALID_METADATA", {
		input: data,
		timeoutMs: 10_000,
	});
	try {
		return JSON.parse(text);
	} catch (cause) {
		throw new NativeBundleError(
			"INVALID_METADATA",
			"Native metadata did not decode to JSON.",
			{ cause },
		);
	}
}
async function verifyIdentity(bundle, version) {
	const info = await plist(
		await readMetadata(join(bundle, "Contents", "Info.plist")),
	);
	const schemes = Array.isArray(info.CFBundleURLTypes)
		? info.CFBundleURLTypes.flatMap((entry) =>
				Array.isArray(entry?.CFBundleURLSchemes)
					? entry.CFBundleURLSchemes
					: [null],
			)
		: [];
	requireValue(
		info.CFBundleName === "Buzz Korean" &&
			info.CFBundleDisplayName === "Buzz Korean" &&
			info.CFBundleIdentifier === "io.github.ondallio.buzz-korean" &&
			info.CFBundleShortVersionString === version &&
			schemes.length === 1 &&
			schemes[0] === "buzz-korean",
		"BUNDLE_IDENTITY_MISMATCH",
		"Native app name, identity, version or URL scheme differs from the Korean channel.",
	);
}
async function snapshot(bundle) {
	const entries = new Map();
	let total = 0;
	async function visit(file, relative, depth) {
		requireValue(
			depth <= 128 && Buffer.byteLength(relative) <= 4096,
			"BUNDLE_ENTRY_LIMIT",
			"Bundle path depth or length limit exceeded.",
		);
		requireValue(
			entries.size < MAX_ENTRIES,
			"BUNDLE_ENTRY_LIMIT",
			"Bundle exceeds 20,000 entries.",
		);
		const stat = await lstat(file, { bigint: true });
		const mode = Number(stat.mode & 0o7777n);
		if (stat.isDirectory()) {
			entries.set(relative, { type: "directory", mode, file, stat });
			const directory = await opendir(file);
			for await (const child of directory)
				await visit(
					join(file, child.name),
					relative ? `${relative}/${child.name}` : child.name,
					depth + 1,
				);
		} else if (stat.isSymbolicLink()) {
			const target = await readlink(file);
			requireValue(
				Buffer.byteLength(target) <= 4096,
				"BUNDLE_ENTRY_LIMIT",
				"Symlink target length exceeds bound.",
			);
			entries.set(relative, { type: "symlink", mode, target, file, stat });
		} else {
			requireValue(
				stat.isFile(),
				"BUNDLE_FILE_TYPE",
				"Bundle contains a device, socket or other unsupported file type.",
			);
			requireValue(
				stat.size <= BigInt(MAX_FILE),
				"BUNDLE_SIZE_LIMIT",
				"Bundle entry exceeds 2 GiB.",
			);
			total += Number(stat.size);
			requireValue(
				total <= MAX_TREE,
				"BUNDLE_SIZE_LIMIT",
				"Bundle tree exceeds 4 GiB.",
			);
			entries.set(relative, {
				type: "file",
				mode,
				size: Number(stat.size),
				file,
				stat,
			});
		}
	}
	const root = await lstat(bundle);
	requireValue(
		root.isDirectory() && !root.isSymbolicLink(),
		"BUNDLE_FILE_TYPE",
		"Expected a real app bundle directory.",
	);
	await visit(bundle, "", 0);
	return { entries, total };
}
async function digest(entry) {
	const handle = await open(
		entry.file,
		constants.O_RDONLY | constants.O_NOFOLLOW,
	);
	try {
		requireValue(
			unchanged(entry.stat, await handle.stat({ bigint: true })),
			"BUNDLE_CHANGED",
			"Bundle entry changed before hashing.",
		);
		const hash = createHash("sha256");
		await streamFile(handle, entry.size, (data) => {
			hash.update(data);
		});
		requireValue(
			unchanged(entry.stat, await handle.stat({ bigint: true })),
			"BUNDLE_CHANGED",
			"Bundle entry changed during hashing.",
		);
		return hash.digest("hex");
	} finally {
		await handle.close();
	}
}
async function compareBundles(archiveApp, mountedApp) {
	const left = await snapshot(archiveApp);
	const right = await snapshot(mountedApp);
	requireValue(
		left.entries.size === right.entries.size,
		"BUNDLE_MISMATCH",
		"Archive and DMG contain different app paths.",
	);
	for (const [name, expected] of left.entries) {
		const observed = right.entries.get(name);
		requireValue(
			observed &&
				expected.type === observed.type &&
				expected.mode === observed.mode &&
				expected.size === observed.size &&
				expected.target === observed.target,
			"BUNDLE_MISMATCH",
			`Archive and DMG differ in app entry metadata: ${name}.`,
		);
	}
	for (const [name, expected] of left.entries)
		if (expected.type === "file")
			requireValue(
				(await digest(expected)) === (await digest(right.entries.get(name))),
				"BUNDLE_MISMATCH",
				`Archive and DMG contain different app file bytes: ${name}.`,
			);
	return { entries: left.entries.size, bytes: left.total };
}

/** Verify pinned archives, native signatures and identical readonly-DMG contents without executing app code. */
export async function verifyNativeBundle({ archive, dmg, version }) {
	parseVersion(version);
	requireValue(
		!SECRET_VARIABLES.some((key) => process.env[key]),
		"SECRET_ENVIRONMENT",
		"Native artifact verification must run before credentials enter the environment.",
	);
	const privateDirectory = await mkdtemp(join(tmpdir(), "buzz-korean-native-"));
	let mountAttempted = false;
	let detachFailed = false;
	const errors = [];
	let receipt;
	const mountpoint = join(privateDirectory, "mount");
	try {
		await chmod(privateDirectory, 0o700);
		const privateArchive = join(privateDirectory, "input.app.tar.gz");
		const privateDmg = join(privateDirectory, "input.dmg");
		await pinInput(archive, privateArchive);
		await pinInput(dmg, privateDmg);
		await tool(
			"python3",
			[ARCHIVE_GATE, privateArchive, version],
			"ARCHIVE_GATE_FAILED",
		);
		const extracted = join(privateDirectory, "extracted");
		await mkdir(extracted, { mode: 0o700 });
		await mkdir(mountpoint, { mode: 0o700 });
		await tool(
			"tar",
			["-xzf", privateArchive, "-C", extracted, "-p"],
			"ARCHIVE_EXTRACT_FAILED",
		);
		const archiveApp = join(extracted, BUNDLE);
		await verifyIdentity(archiveApp, version);
		await tool(
			"codesign",
			["--verify", "--deep", "--strict", archiveApp],
			"ARCHIVE_SIGNATURE_FAILED",
		);
		await tool("hdiutil", ["verify", privateDmg], "DMG_VERIFY_FAILED");
		mountAttempted = true;
		const attached = await tool(
			"hdiutil",
			[
				"attach",
				"-readonly",
				"-nobrowse",
				"-noautoopen",
				"-plist",
				"-mountpoint",
				mountpoint,
				privateDmg,
			],
			"DMG_ATTACH_FAILED",
		);
		const mountInfo = await plist(Buffer.from(attached));
		const mounts = Array.isArray(mountInfo["system-entities"])
			? mountInfo["system-entities"].filter(
					(entry) => typeof entry?.["mount-point"] === "string",
				)
			: [];
		requireValue(
			mounts.length === 1 &&
				(await realpath(mounts[0]["mount-point"])) ===
					(await realpath(mountpoint)),
			"DMG_MOUNT_MISMATCH",
			"DMG did not mount at the isolated expected path.",
		);
		const mountedApp = join(mountpoint, BUNDLE);
		const comparison = await compareBundles(archiveApp, mountedApp);
		await verifyIdentity(mountedApp, version);
		await tool(
			"codesign",
			["--verify", "--deep", "--strict", mountedApp],
			"DMG_SIGNATURE_FAILED",
		);
		receipt = { bundle: BUNDLE, version, ...comparison, detached: true };
	} catch (error) {
		errors.push(error);
	} finally {
		if (mountAttempted) {
			try {
				await tool("hdiutil", ["detach", mountpoint], "DMG_DETACH_FAILED");
			} catch (error) {
				detachFailed = true;
				error.privateDirectory = privateDirectory;
				errors.push(error);
			}
		}
		if (!detachFailed) {
			try {
				await rm(privateDirectory, { recursive: true, force: false });
			} catch (cause) {
				errors.push(
					new NativeBundleError(
						"NATIVE_CLEANUP_FAILED",
						"Could not remove private native-verification files.",
						{ cause, privateDirectory },
					),
				);
			}
		}
	}
	if (errors.length === 1) throw errors[0];
	if (errors.length > 1)
		throw new AggregateError(
			errors,
			"Native verification or required cleanup failed.",
		);
	return receipt;
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
	try {
		requireValue(
			process.platform === "darwin" && process.arch === "arm64",
			"PLATFORM_UNSUPPORTED",
			"Native bundle verification requires an Apple Silicon macOS runner.",
		);
		requireValue(
			process.argv.length === 5,
			"INVALID_ARGUMENTS",
			"Usage: verify-native-bundle.mjs ARCHIVE DMG VERSION",
		);
		console.log(
			JSON.stringify(
				await verifyNativeBundle({
					archive: process.argv[2],
					dmg: process.argv[3],
					version: process.argv[4],
				}),
			),
		);
	} catch (error) {
		console.error(error.code ?? error.name, error.message);
		for (const failure of error.errors ?? [error])
			if (failure.privateDirectory)
				console.error(
					`Retained verification directory: ${failure.privateDirectory}`,
				);
		process.exitCode = 1;
	}
}
