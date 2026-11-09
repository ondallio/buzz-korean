import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const prepareUrl = new URL("../scripts/prepare.mjs", import.meta.url);
const fixtureEnv = {
	...process.env,
	GIT_CONFIG_NOSYSTEM: "1",
	GIT_CONFIG_GLOBAL: os.devNull,
	GIT_AUTHOR_NAME: "Prepare fixture",
	GIT_AUTHOR_EMAIL: "fixture@example.invalid",
	GIT_COMMITTER_NAME: "Prepare fixture",
	GIT_COMMITTER_EMAIL: "fixture@example.invalid",
	GIT_AUTHOR_DATE: "2026-11-04T00:00:00Z",
	GIT_COMMITTER_DATE: "2026-11-04T00:00:00Z",
};
function git(cwd, args, input, extraEnv = {}) {
	return execFileSync(
		"git",
		[
			"-c",
			"commit.gpgSign=false",
			"-c",
			`core.hooksPath=${os.devNull}`,
			...args,
		],
		{
			cwd,
			env: { ...fixtureEnv, ...extraEnv },
			input,
			timeout: 10000,
			maxBuffer: 4 * 1024 * 1024,
			stdio: ["pipe", "pipe", "pipe"],
		},
	);
}
function oid(cwd, args, input, env) {
	return git(cwd, args, input, env).toString().trim();
}
function tree(cwd, files) {
	const root = new Map();
	for (const [name, data] of Object.entries(files)) {
		let parent = root;
		const parts = name.split("/");
		for (const part of parts.slice(0, -1)) {
			if (!parent.has(part)) parent.set(part, new Map());
			parent = parent.get(part);
		}
		parent.set(parts.at(-1), data);
	}
	function build(node) {
		return oid(
			cwd,
			["mktree", "-z"],
			Buffer.concat(
				[...node].map(([name, value]) =>
					Buffer.from(
						value instanceof Map
							? `040000 tree ${build(value)}\t${name}\0`
							: `100644 blob ${oid(cwd, ["hash-object", "-w", "--stdin"], value)}\t${name}\0`,
					),
				),
			),
		);
	}
	return build(root);
}
function commit(cwd, sourceTree, date, parents = []) {
	return oid(
		cwd,
		["commit-tree", sourceTree, ...parents.flatMap((parent) => ["-p", parent])],
		"fixture\n",
		{ GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
	);
}
const english = Array.from(
	{ length: 24 },
	(_, index) => `line ${index + 1}\n`,
).join("");
const korean = english.replace("line 1\n", "한글 번역\n");
function sourceFiles(version, mismatch = {}) {
	return {
		"desktop/package.json":
			JSON.stringify({ name: "buzz", version: mismatch.package ?? version }) +
			"\n",
		"desktop/src-tauri/tauri.conf.json": `${JSON.stringify({
			version: mismatch.tauri ?? version,
			identifier: "fixture.official",
		})}\n`,
		"desktop/src-tauri/Cargo.toml": `[package]\nname = "buzz-desktop"\nversion = "${mismatch.cargo ?? version}"\n`,
		"desktop/messages.txt":
			version === "0.5.28"
				? english
				: english.replace("line 22\n", "new official behavior\n"),
		"source-after-old-stable.txt": "KEEP NEWER SNAPSHOT\n",
		".github/workflows/upstream.yml": "UPSTREAM WORKFLOW STAYS UNDER APP\n",
	};
}

async function fixture(
	t,
	{
		newer = false,
		mismatch = {},
		verified = true,
		commitDate = "2026-11-04T02:50:08Z",
	} = {},
) {
	const originalCwd = process.cwd();
	const base = await mkdtemp(
		path.join(os.tmpdir(), "buzz-korean-prepare-test-"),
	);
	const cwd = path.join(base, "management");
	const upstream = path.join(base, "official-source");
	const origin = path.join(base, "origin.git");
	const bin = path.join(base, "bin");
	const config = path.join(base, "gh-config");
	for (const directory of [cwd, upstream, bin, config]) await mkdir(directory);
	git(cwd, ["init", "--quiet", "--initial-branch=main"]);
	git(upstream, ["init", "--quiet", "--initial-branch=main"]);
	git(base, ["init", "--quiet", "--bare", origin]);
	const baseTree = tree(upstream, sourceFiles("0.5.28"));
	const sourceCommit = commit(upstream, baseTree, "2026-11-03T02:50:08Z");
	const oldCommit = commit(
		upstream,
		tree(upstream, {
			...sourceFiles("0.5.28"),
			"desktop/messages.txt": "OLD STABLE DO NOT IMPORT\n",
			"source-after-old-stable.txt": "OLDER CONTENT\n",
		}),
		"2026-10-09T19:25:59Z",
	);
	const unrelated = commit(
		upstream,
		tree(upstream, { "side-history.txt": "INDEPENDENT RELEASE HISTORY\n" }),
		"2026-11-04T00:00:00Z",
	);
	const nextTree = tree(upstream, sourceFiles("0.5.29", mismatch));
	const nextCommit = commit(upstream, nextTree, commitDate, [unrelated]);
	for (const [name, value] of [
		["snapshot", sourceCommit],
		["old-release", oldCommit],
		["next-release", nextCommit],
	])
		git(upstream, ["update-ref", `refs/heads/${name}`, value]);
	git(cwd, ["remote", "add", "upstream", upstream]);
	git(cwd, ["fetch", "--quiet", "upstream", sourceCommit]);
	git(cwd, ["remote", "add", "origin", origin]);
	const lock = {
		schemaVersion: 1,
		upstreamRepository: "block/buzz",
		sourceCommit,
		sourceTree: baseTree,
		upstreamVersion: "0.5.28",
		lastObservedRelease: {
			tag: "desktop-v0.5.28",
			commit: oldCommit,
			tagObject: oldCommit,
			releaseId: 28,
		},
		channelRepository: "ondallio/buzz-korean",
		channelVersion: "1.0.0",
		platform: "darwin-aarch64",
	};
	const headTree = tree(cwd, {
		...Object.fromEntries(
			Object.entries({
				...sourceFiles("0.5.28"),
				"desktop/messages.txt": korean,
			}).map(([name, data]) => [`app/${name}`, data]),
		),
		"README.md": "TRUSTED MANAGEMENT ROOT\n",
		"scripts/trusted.mjs": "TRUSTED SOURCE\n",
		".github/workflows/release.yml": "TRUSTED ROOT WORKFLOW\n",
		"upstream.lock.json": `${JSON.stringify(lock, null, 2)}\n`,
	});
	const head = commit(cwd, headTree, "2026-11-04T04:00:00Z");
	git(cwd, ["update-ref", "refs/heads/main", head]);
	git(cwd, ["reset", "--hard", "--quiet", head]);
	git(cwd, ["push", "--quiet", "origin", "HEAD:refs/heads/main"]);
	const tag = newer ? "desktop-v0.5.29" : "desktop-v0.5.28";
	const target = newer ? nextCommit : oldCommit;
	const responses = {
		"repos/ondallio/buzz-korean/releases?per_page=100&page=1": [],
		"repos/block/buzz/releases?per_page=100&page=1": [
			{
				id: newer ? 29 : 28,
				tag_name: tag,
				draft: false,
				prerelease: false,
				published_at: newer ? "2026-11-04T04:00:00Z" : "2026-10-09T20:52:44Z",
			},
		],
		[`repos/block/buzz/git/ref/tags/${tag}`]: {
			object: { type: "commit", sha: target },
		},
		[`repos/block/buzz/commits/${nextCommit}`]: {
			commit: { verification: { verified }, committer: { date: commitDate } },
		},
		"repos/ondallio/buzz-korean/releases": { id: 9001 },
	};
	const responseFile = path.join(base, "responses.json");
	const journal = path.join(base, "gh-journal.jsonl");
	await writeFile(responseFile, JSON.stringify(responses));
	await writeFile(
		path.join(bin, "gh"),
		`#!${process.execPath}\nconst fs=require('node:fs');const args=process.argv.slice(2);const endpoint=args[1];const method=args[args.indexOf('--method')+1];const calls=fs.existsSync(process.env.PREPARE_TEST_JOURNAL)?fs.readFileSync(process.env.PREPARE_TEST_JOURNAL,'utf8').trim().split('\\n').filter(Boolean).map(JSON.parse):[];const input=fs.readFileSync(0,'utf8');const data=input?JSON.parse(input):undefined;fs.appendFileSync(process.env.PREPARE_TEST_JOURNAL,JSON.stringify({endpoint,method,data,cwd:process.cwd(),config:process.env.GH_CONFIG_DIR})+'\\n');const responses=JSON.parse(fs.readFileSync(process.env.PREPARE_TEST_RESPONSES,'utf8'));let response=responses[endpoint];if(response&&response.sequence){const count=calls.filter(c=>c.endpoint===endpoint&&c.method===method).length;response=response.sequence[Math.min(count,response.sequence.length-1)];}if(args[0]!=='api'||response===undefined){console.error('Unexpected isolated API call '+endpoint);process.exit(9);}process.stdout.write(JSON.stringify(response));\n`,
		{ mode: 0o755 },
	);
	const changes = {
		PATH: `${bin}${path.delimiter}${process.env.PATH}`,
		GH_CONFIG_DIR: config,
		PREPARE_TEST_RESPONSES: responseFile,
		PREPARE_TEST_JOURNAL: journal,
		GITHUB_RUN_ID: "777",
		GIT_CONFIG_GLOBAL: os.devNull,
		GIT_CONFIG_NOSYSTEM: "1",
		GIT_AUTHOR_NAME: fixtureEnv.GIT_AUTHOR_NAME,
		GIT_AUTHOR_EMAIL: fixtureEnv.GIT_AUTHOR_EMAIL,
		GIT_COMMITTER_NAME: fixtureEnv.GIT_COMMITTER_NAME,
		GIT_COMMITTER_EMAIL: fixtureEnv.GIT_COMMITTER_EMAIL,
		GIT_AUTHOR_DATE: fixtureEnv.GIT_AUTHOR_DATE,
		GIT_COMMITTER_DATE: fixtureEnv.GIT_COMMITTER_DATE,
	};
	const saved = Object.fromEntries(
		[
			...new Set([
				...Object.keys(changes),
				"GH_TOKEN",
				"GITHUB_TOKEN",
				"GH_ENTERPRISE_TOKEN",
			]),
		].map((key) => [key, process.env[key]]),
	);
	for (const key of ["GH_TOKEN", "GITHUB_TOKEN", "GH_ENTERPRISE_TOKEN"])
		delete process.env[key];
	Object.assign(process.env, changes);
	process.chdir(cwd);
	t.after(async () => {
		process.chdir(originalCwd);
		for (const [key, value] of Object.entries(saved)) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
		await rm(base, { recursive: true, force: true });
	});
	const module = await import(
		`${prepareUrl.href}?fixture=${path.basename(base)}`
	);
	return {
		cwd,
		origin,
		upstream,
		head,
		lock,
		sourceCommit,
		oldCommit,
		nextCommit,
		nextTree,
		tag,
		responses,
		prepare: module.prepare,
		nextVersion: module.nextVersion,
		async respond() {
			await writeFile(responseFile, JSON.stringify(responses));
		},
		async calls() {
			return (await readFile(journal, "utf8").catch(() => ""))
				.split("\n")
				.filter(Boolean)
				.map(JSON.parse);
		},
	};
}
async function state(s) {
	const status = git(s.cwd, ["status", "--porcelain=v1", "-z"]).toString();
	return {
		head: oid(s.cwd, ["rev-parse", "HEAD"]),
		main: oid(s.cwd, ["rev-parse", "refs/heads/main"]),
		originMain: oid(s.cwd, [
			"--git-dir",
			s.origin,
			"rev-parse",
			"refs/heads/main",
		]),
		refs: git(s.cwd, [
			"for-each-ref",
			"--format=%(refname) %(objectname)",
		]).toString(),
		status,
		index: await readFile(path.join(s.cwd, ".git/index")),
		lock: await readFile(path.join(s.cwd, "upstream.lock.json")),
		messages: await readFile(path.join(s.cwd, "app/desktop/messages.txt")),
	};
}
async function assertNoDraft(s) {
	assert.equal(
		(await s.calls()).filter((call) => call.method !== "GET").length,
		0,
	);
}

test("current observed stable release cannot downgrade the newer applied source snapshot", async (t) => {
	const s = await fixture(t);
	const before = await state(s);
	assert.deepEqual(await s.prepare(), { build: false });
	assert.deepEqual(await state(s), before);
	await assertNoDraft(s);
	assert.ok(
		(await s.calls()).every((call) =>
			call.config.startsWith(path.dirname(s.cwd)),
		),
	);
});
test("malformed official tag identity rejects before any main/index/worktree change", async (t) => {
	const s = await fixture(t);
	s.responses[`repos/block/buzz/git/ref/tags/${s.tag}`] = {
		object: { type: "commit", sha: "main;echo injected" },
	};
	await s.respond();
	const before = await state(s);
	await assert.rejects(() => s.prepare(), /Invalid tag SHA/);
	assert.deepEqual(await state(s), before);
	await assertNoDraft(s);
});
test("retargeted already observed stable tag is rejected rather than silently skipped", async (t) => {
	const s = await fixture(t);
	s.responses[`repos/block/buzz/git/ref/tags/${s.tag}`] = {
		object: { type: "commit", sha: s.nextCommit },
	};
	await s.respond();
	const before = await state(s);
	await assert.rejects(() => s.prepare(), { code: "TAG_RETARGETED" });
	assert.deepEqual(await state(s), before);
	await assertNoDraft(s);
});
test("buildCurrent creates an isolated candidate and draft reservation without downgrading source or pushing main", async (t) => {
	const s = await fixture(t);
	let result;
	try {
		result = await s.prepare({ buildCurrent: true });
	} catch (error) {
		error.message += `; currentBranch=${oid(s.cwd, ["branch", "--show-current"])}; HEADunchanged=${oid(s.cwd, ["rev-parse", "HEAD"]) === s.head}; stagedDiff=${git(s.cwd, ["diff", "--cached", "--stat"]).toString()}; worktreeStatus=${git(s.cwd, ["status", "--porcelain"]).toString()}; apiPosts=${(await s.calls()).filter((call) => call.method !== "GET").length}`;
		throw error;
	}
	assert.equal(result.build, true);
	assert.equal(result.sourceCommit, s.sourceCommit);
	assert.equal(result.version, "1.0.0");
	assert.equal(result.releaseId, 9001);
	assert.equal(oid(s.cwd, ["rev-parse", "refs/heads/main"]), s.head);
	assert.equal(
		oid(s.cwd, ["--git-dir", s.origin, "rev-parse", "refs/heads/main"]),
		s.head,
	);
	assert.equal(
		oid(s.cwd, [
			"--git-dir",
			s.origin,
			"rev-parse",
			`refs/heads/${result.branch}`,
		]),
		result.candidateCommit,
	);
	const lock = JSON.parse(
		await readFile(path.join(s.cwd, "upstream.lock.json"), "utf8"),
	);
	assert.equal(lock.sourceCommit, s.sourceCommit);
	assert.equal(lock.lastObservedRelease.commit, s.oldCommit);
	assert.equal(
		await readFile(path.join(s.cwd, "app/desktop/messages.txt"), "utf8"),
		korean,
	);
	const post = (await s.calls()).find((call) => call.method === "POST");
	assert.equal(post.data.draft, true);
	assert.equal(post.data.make_latest, "false");
	assert.equal(post.data.target_commitish, result.candidateCommit);
	assert.equal(JSON.parse(post.data.body).controlCommit, s.head);
	assert.equal(JSON.parse(post.data.body).runId, "777");
});
test("a newer verified stable release on side history merges real source versions and retains Korean/root workflow changes", async (t) => {
	const s = await fixture(t, { newer: true });
	assert.throws(() =>
		git(s.upstream, ["merge-base", s.sourceCommit, s.nextCommit]),
	);
	const result = await s.prepare();
	assert.equal(result.build, true);
	assert.equal(result.sourceCommit, s.nextCommit);
	assert.equal(
		await readFile(path.join(s.cwd, "app/desktop/messages.txt"), "utf8"),
		korean.replace("line 22\n", "new official behavior\n"),
	);
	assert.equal(
		await readFile(path.join(s.cwd, ".github/workflows/release.yml"), "utf8"),
		"TRUSTED ROOT WORKFLOW\n",
	);
	assert.equal(
		await readFile(
			path.join(s.cwd, "app/.github/workflows/upstream.yml"),
			"utf8",
		),
		"UPSTREAM WORKFLOW STAYS UNDER APP\n",
	);
	assert.equal(oid(s.cwd, ["rev-parse", "refs/heads/main"]), s.head);
	assert.equal(
		oid(s.cwd, ["--git-dir", s.origin, "rev-parse", "refs/heads/main"]),
		s.head,
	);
	const lock = JSON.parse(
		await readFile(path.join(s.cwd, "upstream.lock.json"), "utf8"),
	);
	assert.equal(lock.upstreamVersion, "0.5.29");
	assert.equal(lock.sourceCommit, s.nextCommit);
	assert.equal(lock.lastObservedRelease.tagObject, s.nextCommit);
});
for (const component of ["package", "tauri", "cargo"]) {
	test(`official ${component} version mismatch blocks before main/index/worktree mutation or draft publication`, async (t) => {
		const s = await fixture(t, {
			newer: true,
			mismatch: { [component]: "0.5.28" },
		});
		const before = await state(s);
		await assert.rejects(() => s.prepare(), /version mismatch/);
		assert.deepEqual(await state(s), before);
		await assertNoDraft(s);
	});
}
for (const verified of [false, "false"]) {
	test(`official commit verification must be boolean true, rejecting ${JSON.stringify(verified)}`, async (t) => {
		const s = await fixture(t, { newer: true, verified });
		const before = await state(s);
		await assert.rejects(() => s.prepare(), /not verified/);
		assert.deepEqual(await state(s), before);
		await assertNoDraft(s);
	});
}
test("tag movement during source fetch is rejected before candidate checkout or reservation", async (t) => {
	const s = await fixture(t, { newer: true });
	s.responses[`repos/block/buzz/git/ref/tags/${s.tag}`] = {
		sequence: [
			{ object: { type: "commit", sha: s.nextCommit } },
			{ object: { type: "commit", sha: s.oldCommit } },
		],
	};
	await s.respond();
	const before = await state(s);
	await assert.rejects(() => s.prepare(), { code: "TAG_RETARGETED" });
	assert.deepEqual(await state(s), before);
	await assertNoDraft(s);
});
test("a numerically newer release with source predating the fixed initial snapshot is rejected", async (t) => {
	const s = await fixture(t, {
		newer: true,
		commitDate: "2026-11-02T00:00:00Z",
	});
	const before = await state(s);
	await assert.rejects(() => s.prepare(), { code: "SOURCE_BEFORE_FLOOR" });
	assert.deepEqual(await state(s), before);
	await assertNoDraft(s);
});
test("channel patch selection reserves draft versions and uses numeric ordering", async (t) => {
	const s = await fixture(t);
	assert.equal(s.nextVersion([]), "1.0.0");
	assert.equal(
		s.nextVersion([
			{ tag_name: "korean-v1.0.9", draft: false },
			{ tag_name: "korean-v1.0.10", draft: true },
			{ tag_name: "desktop-v99.0.0" },
		]),
		"1.0.11",
	);
	assert.equal(
		s.nextVersion([
			{ tag_name: "korean-v1.0.01" },
			{ tag_name: "mobile-v99.0.0" },
		]),
		"1.0.0",
	);
	assert.throws(
		() => s.nextVersion([{ tag_name: "korean-v1.0.9007199254740991" }]),
		/exhausted/,
	);
});
