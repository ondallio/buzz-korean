import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
	access,
	chmod,
	lstat,
	mkdir,
	mkdtemp,
	readFile,
	rm,
	symlink,
	writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const native = await import("../scripts/verify-native-bundle.mjs").catch(
	(error) => {
		if (error.code === "ERR_MODULE_NOT_FOUND") return {};
		throw error;
	},
);
function api() {
	assert.equal(
		typeof native.verifyNativeBundle,
		"function",
		"production verifyNativeBundle is exported",
	);
	return native.verifyNativeBundle;
}
const helpers = [
	"buzz-korean-app",
	"buzz-acp",
	"buzz-agent",
	"buzz-backend-kubernetes",
	"buzz-dev-mcp",
	"git-credential-nostr",
	"buzz",
];
const permissionCatalogs = Object.fromEntries(
	await Promise.all(
		["en", "ko"].map(async (locale) => [
			locale,
			JSON.parse(
				await readFile(
					new URL(`../locales/macos.${locale}.json`, import.meta.url),
					"utf8",
				),
			),
		]),
	),
);
const keyNames = [
	"TAURI_SIGNING_PRIVATE_KEY",
	"TAURI_SIGNING_PRIVATE_KEY_PASSWORD",
	"KOREAN_UPDATER_PRIVATE_KEY",
	"GH_TOKEN",
	"GITHUB_TOKEN",
];
const commands = `#!${process.execPath}
const fs=require('node:fs');const path=require('node:path');const args=process.argv.slice(2);const tool=path.basename(process.argv[1]);const config=JSON.parse(fs.readFileSync(process.env.NATIVE_TEST_CONFIG,'utf8'));const mode=config.fault;fs.appendFileSync(config.journal,JSON.stringify({tool,args})+'\\n');
if(['TAURI_SIGNING_PRIVATE_KEY','KOREAN_UPDATER_PRIVATE_KEY','GH_TOKEN','GITHUB_TOKEN'].some(key=>process.env[key]))process.exit(90);
if(tool==='codesign'){if((mode==='archive-signature'&&!args.at(-1).includes('/mount/'))||(mode==='mounted-signature'&&args.at(-1).includes('/mount/')))process.exit(3);process.exit(0);}
if(args[0]==='verify'){if(mode==='invalid-dmg')process.exit(4);process.exit(0);}
if(args[0]==='attach'){
 const mount=args[args.indexOf('-mountpoint')+1];fs.mkdirSync(mount,{recursive:true});fs.cpSync(config.bundle,path.join(mount,'Buzz Korean.app'),{recursive:true,dereference:false,preserveTimestamps:true,verbatimSymlinks:true});const app=path.join(mount,'Buzz Korean.app');
 if(mode==='bytes'||mode==='bytes-and-detach')fs.writeFileSync(path.join(app,'Contents/Resources/payload.txt'),'PAYLOAD TWO\\n');
 if(mode==='mode')fs.chmodSync(path.join(app,'Contents/Resources/payload.txt'),0o600);
 if(mode==='missing')fs.unlinkSync(path.join(app,'Contents/Resources/payload.txt'));
 if(mode==='extra')fs.writeFileSync(path.join(app,'Contents/Resources/extra.txt'),'EXTRA');
 if(mode==='symlink'){fs.unlinkSync(path.join(app,'Contents/Resources/Current'));fs.symlinkSync('../../../../../outside.txt',path.join(app,'Contents/Resources/Current'));}
 if(mode==='oversized'){const fd=fs.openSync(path.join(app,'Contents/Resources/oversized'),'w');fs.ftruncateSync(fd,2*1024**3+1);fs.closeSync(fd);}
 if(mode==='tree-size'){for(let i=0;i<3;i++){const fd=fs.openSync(path.join(app,'Contents/Resources/large-'+i),'w');fs.ftruncateSync(fd,1536*1024**2);fs.closeSync(fd);}}
 if(mode==='entries'){for(let i=0;i<20001;i++)fs.writeFileSync(path.join(app,'Contents/Resources/count-'+i),'');}
 if(mode==='attach-after-mount')process.exit(5);if(mode==='bad-mount-plist'){process.stdout.write('not a plist');process.exit(0);}
 const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
 process.stdout.write('<?xml version="1.0"?><plist version="1.0"><dict><key>system-entities</key><array><dict><key>dev-entry</key><string>/dev/disk4242</string><key>mount-point</key><string>'+escape(mount)+'</string></dict></array></dict></plist>');process.exit(0);
}
if(args[0]==='detach'){if(mode==='detach'||mode==='bytes-and-detach')process.exit(6);fs.rmSync(args[1],{recursive:true,force:true});fs.mkdirSync(args[1]);if(mode==='cleanup')fs.chmodSync(path.dirname(args[1]),0o500);process.exit(0);}
process.exit(91);
`;
async function fixture(
	t,
	{
		fault = "",
		name = "Buzz Korean",
		displayName = "Buzz Korean",
		schemes = ["buzz", "buzz-korean"],
		localizations = true,
	} = {},
) {
	const base = await mkdtemp(path.join(os.tmpdir(), "buzz-native-fixture-"));
	const source = path.join(base, "source");
	const bundle = path.join(source, "Buzz Korean.app");
	const macos = path.join(bundle, "Contents/MacOS");
	const resources = path.join(bundle, "Contents/Resources");
	const bin = path.join(base, "bin");
	await mkdir(macos, { recursive: true, mode: 0o755 });
	await mkdir(resources, { recursive: true, mode: 0o755 });
	await mkdir(bin);
	const marker = path.join(base, "APP_MUST_NOT_RUN");
	const usage = Object.entries(permissionCatalogs.en)
		.map(([key, value]) => `<key>${key}</key><string>${value}</string>`)
		.join("");
	const plist = `<?xml version="1.0"?><plist version="1.0"><dict><key>CFBundleName</key><string>${name}</string><key>CFBundleDisplayName</key><string>${displayName}</string><key>CFBundleIdentifier</key><string>io.github.ondallio.buzz-korean</string><key>CFBundleShortVersionString</key><string>1.0.1</string><key>CFBundleDevelopmentRegion</key><string>en</string><key>CFBundleLocalizations</key><array><string>en</string><string>ko</string></array>${usage}<key>CFBundleExecutable</key><string>buzz-korean-app</string><key>CFBundleURLTypes</key><array><dict><key>CFBundleURLSchemes</key><array>${schemes.map((scheme) => `<string>${scheme}</string>`).join("")}</array></dict></array></dict></plist>`;
	await writeFile(path.join(bundle, "Contents/Info.plist"), plist, {
		mode: 0o644,
	});
	if (localizations)
		for (const locale of ["en", "ko"]) {
			const destination = path.join(
				resources,
				`${locale}.lproj`,
				"InfoPlist.strings",
			);
			await mkdir(path.dirname(destination), { recursive: true, mode: 0o755 });
			execFileSync("python3", [
				"-c",
				"import json,plistlib,sys; plistlib.dump(json.loads(sys.argv[1]),open(sys.argv[2],'wb'),fmt=plistlib.FMT_BINARY)",
				JSON.stringify(permissionCatalogs[locale]),
				destination,
			]);
		}
	const macho = Buffer.alloc(32);
	macho.writeUInt32LE(0xfeedfacf, 0);
	macho.writeUInt32LE(0x0100000c, 4);
	macho.writeUInt32LE(2, 12);
	for (const helper of helpers) {
		const file = path.join(macos, helper);
		await writeFile(file, macho);
		await chmod(file, 0o755);
	}
	await writeFile(path.join(resources, "payload.txt"), "PAYLOAD ONE\n", {
		mode: 0o644,
	});
	await writeFile(
		path.join(resources, "never-run.sh"),
		`#!/bin/sh\nprintf BAD > '${marker}'\n`,
		{ mode: 0o755 },
	);
	await symlink("payload.txt", path.join(resources, "Current"));
	const archive = path.join(base, "BuzzKorean.app.tar.gz");
	const dmg = path.join(base, "BuzzKorean.dmg");
	execFileSync("tar", ["-czf", archive, "-C", source, "Buzz Korean.app"], {
		timeout: 10000,
		maxBuffer: 1024 * 1024,
		env: { ...process.env, COPYFILE_DISABLE: "1" },
	});
	await writeFile(dmg, "FAKE DISK IMAGE\n");
	if (
		!fault &&
		name === "Buzz Korean" &&
		displayName === "Buzz Korean" &&
		JSON.stringify(schemes) === JSON.stringify(["buzz", "buzz-korean"])
	) {
		try {
			execFileSync(
				"python3",
				[
					new URL("../scripts/verify-archive.py", import.meta.url).pathname,
					archive,
					"1.0.1",
				],
				{
					timeout: 10000,
					maxBuffer: 1024 * 1024,
					stdio: ["pipe", "pipe", "pipe"],
				},
			);
		} catch (error) {
			const members = execFileSync("tar", ["-tzf", archive])
				.toString()
				.slice(0, 4000);
			await rm(base, { recursive: true, force: true });
			throw new Error(
				`Native fixture archive invalid: ${error.stderr?.toString()}; members=${members}`,
				{ cause: error },
			);
		}
	}

	const config = path.join(base, "fixture.json");
	const journal = path.join(base, "commands.jsonl");
	await writeFile(config, JSON.stringify({ fault, bundle, journal }));
	for (const tool of ["codesign", "hdiutil"])
		await writeFile(path.join(bin, tool), commands, { mode: 0o755 });
	const names = [...keyNames, "PATH", "NATIVE_TEST_CONFIG"];
	const saved = Object.fromEntries(names.map((key) => [key, process.env[key]]));
	for (const key of keyNames) delete process.env[key];
	process.env.PATH = `${bin}${path.delimiter}${process.env.PATH}`;
	process.env.NATIVE_TEST_CONFIG = config;
	const calls = async () =>
		(await readFile(journal, "utf8").catch(() => ""))
			.split("\n")
			.filter(Boolean)
			.map(JSON.parse);
	t.after(async () => {
		for (const call of await calls())
			if (call.tool === "hdiutil" && call.args[0] === "attach") {
				const mount = call.args[call.args.indexOf("-mountpoint") + 1];
				const owned = path.dirname(mount);
				assert.ok(
					owned.startsWith(path.join(os.tmpdir(), "buzz-korean-native-")),
				);
				await chmod(owned, 0o700).catch(() => {});
				await rm(owned, { recursive: true, force: true });
			}
		for (const [key, value] of Object.entries(saved)) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
		await rm(base, { recursive: true, force: true });
	});
	return {
		archive,
		dmg,
		calls,
		marker,
		bundle,
		version: "1.0.1",
		async mountpoint() {
			const call = (await calls()).find(
				(item) => item.tool === "hdiutil" && item.args[0] === "attach",
			);
			return call?.args[call.args.indexOf("-mountpoint") + 1];
		},
	};
}
function hasCode(error, code) {
	return (
		error.code === code || error.errors?.some((item) => hasCode(item, code))
	);
}
async function exists(file) {
	return access(file).then(
		() => true,
		() => false,
	);
}

test("valid archive and readonly DMG app compare identically without executing app resources", async (t) => {
	const verify = api();
	const f = await fixture(t);
	const receipt = await verify(f);
	assert.equal(receipt.version, "1.0.1");
	assert.equal(receipt.entries, 19);
	assert.equal(receipt.bundle, "Buzz Korean.app");
	const calls = await f.calls();
	assert.equal(calls.filter((call) => call.tool === "codesign").length, 2);
	const attach = calls.find((call) => call.args[0] === "attach");
	for (const flag of ["-readonly", "-nobrowse", "-noautoopen", "-plist"])
		assert.ok(attach.args.includes(flag));
	assert.equal(calls.filter((call) => call.args[0] === "detach").length, 1);
	assert.equal(await exists(path.dirname(await f.mountpoint())), false);
	assert.equal(await exists(f.marker), false);
});
for (const [fault, code] of [
	["bytes", "BUNDLE_MISMATCH"],
	["mode", "BUNDLE_MISMATCH"],
	["symlink", "BUNDLE_MISMATCH"],
	["missing", "BUNDLE_MISMATCH"],
	["extra", "BUNDLE_MISMATCH"],
	["oversized", "BUNDLE_SIZE_LIMIT"],
	["tree-size", "BUNDLE_SIZE_LIMIT"],
	["entries", "BUNDLE_ENTRY_LIMIT"],
]) {
	test(`${fault} mismatch rejects and still detaches before private cleanup`, async (t) => {
		const verify = api();
		const f = await fixture(t, { fault });
		await assert.rejects(
			() => verify(f),
			(error) => hasCode(error, code),
		);
		const calls = await f.calls();
		assert.equal(calls.filter((call) => call.args[0] === "detach").length, 1);
		assert.equal(await exists(path.dirname(await f.mountpoint())), false);
		assert.equal(await exists(f.marker), false);
	});
}
for (const fault of ["archive-signature", "invalid-dmg"]) {
	test(`${fault} rejects before mount`, async (t) => {
		const verify = api();
		const f = await fixture(t, { fault });
		await assert.rejects(() => verify(f));
		assert.equal(
			(await f.calls()).some((call) => call.args[0] === "attach"),
			false,
		);
	});
}
test("mounted-app code signature failure still detaches", async (t) => {
	const verify = api();
	const f = await fixture(t, { fault: "mounted-signature" });
	await assert.rejects(() => verify(f));
	assert.equal(
		(await f.calls()).filter((call) => call.args[0] === "detach").length,
		1,
	);
	assert.equal(await exists(path.dirname(await f.mountpoint())), false);
});
test("missing macOS language resources cannot pass the native release gate", async (t) => {
	const f = await fixture(t, { localizations: false });
	await assert.rejects(
		() => api()(f),
		/localiz|language|metadata|InfoPlist|ENOENT/i,
	);
});
test("partial attach failure attempts detach rather than deleting a possibly mounted filesystem", async (t) => {
	const verify = api();
	const f = await fixture(t, { fault: "attach-after-mount" });
	await assert.rejects(() => verify(f));
	assert.equal(
		(await f.calls()).filter((call) => call.args[0] === "detach").length,
		1,
	);
	assert.equal(await exists(path.dirname(await f.mountpoint())), false);
});
test("detach failure propagates and preserves the mounted private directory", async (t) => {
	const verify = api();
	const f = await fixture(t, { fault: "detach" });
	await assert.rejects(
		() => verify(f),
		(error) => hasCode(error, "DMG_DETACH_FAILED"),
	);
	const mount = await f.mountpoint();
	assert.equal(
		await exists(path.join(mount, "Buzz Korean.app/Contents/Info.plist")),
		true,
	);
	assert.equal((await lstat(path.dirname(mount))).mode & 0o777, 0o700);
});
test("cleanup failure is not reported as successful verification", async (t) => {
	const verify = api();
	const f = await fixture(t, { fault: "cleanup" });
	await assert.rejects(
		() => verify(f),
		(error) => hasCode(error, "NATIVE_CLEANUP_FAILED"),
	);
	assert.equal(
		(await f.calls()).filter((call) => call.args[0] === "detach").length,
		1,
	);
});
for (const metadata of [
	{ name: "Buzz" },
	{ displayName: "Official Buzz" },
	{ schemes: ["buzz"] },
	{ schemes: ["buzz-korean"] },
	{ schemes: ["buzz", "unknown"] },
	{ schemes: ["buzz", "buzz-korean", "unknown"] },
	{ schemes: ["buzz", "buzz"] },
]) {
	test(`extracted app identity is independently rejected ${JSON.stringify(metadata)}`, async (t) => {
		const verify = api();
		const f = await fixture(t, metadata);
		await assert.rejects(
			() => verify(f),
			(error) => hasCode(error, "BUNDLE_IDENTITY_MISMATCH"),
		);
		assert.equal(
			(await f.calls()).some((call) => call.args[0] === "attach"),
			false,
		);
	});
}
test("the actual Python archive validator rejects a wrong requested version before native tools", async (t) => {
	const verify = api();
	const f = await fixture(t);
	await assert.rejects(
		() => verify({ ...f, version: "1.0.2" }),
		(error) => hasCode(error, "ARCHIVE_GATE_FAILED"),
	);
	assert.deepEqual(await f.calls(), []);
});
test("signing credentials are rejected before archive inspection or native commands", async (t) => {
	const verify = api();
	const f = await fixture(t);
	process.env.TAURI_SIGNING_PRIVATE_KEY = "TEST_ONLY_NOT_A_KEY";
	await assert.rejects(
		() => verify(f),
		(error) => hasCode(error, "SECRET_ENVIRONMENT"),
	);
	assert.deepEqual(await f.calls(), []);
});

test("a comparison failure and detach failure both remain visible with the private mount preserved", async (t) => {
	const verify = api();
	const f = await fixture(t, { fault: "bytes-and-detach" });
	await assert.rejects(
		() => verify(f),
		(error) =>
			error instanceof AggregateError &&
			hasCode(error, "BUNDLE_MISMATCH") &&
			hasCode(error, "DMG_DETACH_FAILED"),
	);
	assert.equal(
		await exists(path.join(await f.mountpoint(), "Buzz Korean.app")),
		true,
	);
});
test("malformed successful attach metadata still detaches before cleanup", async (t) => {
	const verify = api();
	const f = await fixture(t, { fault: "bad-mount-plist" });
	await assert.rejects(
		() => verify(f),
		(error) => hasCode(error, "INVALID_METADATA"),
	);
	assert.equal(
		(await f.calls()).filter((call) => call.args[0] === "detach").length,
		1,
	);
	assert.equal(await exists(path.dirname(await f.mountpoint())), false);
});
for (const [platform, arch] of [
	["linux", "arm64"],
	["darwin", "x64"],
]) {
	test(`CLI refuses unsupported ${platform}/${arch} before touching artifacts or native tools`, async (t) => {
		api();
		const f = await fixture(t);
		const cli = new URL("../scripts/verify-native-bundle.mjs", import.meta.url);
		const code = `Object.defineProperty(process,'platform',{value:${JSON.stringify(platform)}});Object.defineProperty(process,'arch',{value:${JSON.stringify(arch)}});process.argv=[process.execPath,${JSON.stringify(cli.pathname)},${JSON.stringify(f.archive)},${JSON.stringify(f.dmg)},'1.0.1'];await import(${JSON.stringify(cli.href)});`;
		assert.throws(
			() =>
				execFileSync(process.execPath, ["--input-type=module", "-e", code], {
					env: process.env,
					timeout: 10000,
					stdio: ["pipe", "pipe", "pipe"],
				}),
			(error) =>
				error.status === 1 &&
				error.stderr.toString().includes("PLATFORM_UNSUPPORTED"),
		);
		assert.deepEqual(await f.calls(), []);
	});
}
