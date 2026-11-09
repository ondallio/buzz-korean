import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const integration = await import("../scripts/git-integration.mjs").catch(
	(error) => {
		if (error.code === "ERR_MODULE_NOT_FOUND") return {};
		throw error;
	},
);
const env = {
	...process.env,
	GIT_CONFIG_NOSYSTEM: "1",
	GIT_CONFIG_GLOBAL: os.devNull,
	GIT_AUTHOR_NAME: "Fixture",
	GIT_AUTHOR_EMAIL: "fixture@example.invalid",
	GIT_COMMITTER_NAME: "Fixture",
	GIT_COMMITTER_EMAIL: "fixture@example.invalid",
	GIT_AUTHOR_DATE: "2026-01-01T00:00:00Z",
	GIT_COMMITTER_DATE: "2026-01-01T00:00:00Z",
};
function git(cwd, args, input) {
	return execFileSync("git", ["-c", "commit.gpgSign=false", ...args], {
		cwd,
		env,
		input,
		timeout: 10000,
		maxBuffer: 4 * 1024 * 1024,
		stdio: ["pipe", "pipe", "pipe"],
	});
}
function oid(cwd, args, input) {
	return git(cwd, args, input).toString().trim();
}
async function fixture(t) {
	const cwd = await fs.mkdtemp(
		path.join(os.tmpdir(), "buzz-korean-merge-test-"),
	);
	t.after(() => fs.rm(cwd, { recursive: true, force: true }));
	git(cwd, ["init", "--quiet", "--initial-branch=main"]);
	return cwd;
}
function tree(cwd, files) {
	const node = new Map();
	for (const [name, value] of Object.entries(files)) {
		const pieces = name.split("/");
		let current = node;
		for (const piece of pieces.slice(0, -1)) {
			if (!current.has(piece)) current.set(piece, new Map());
			current = current.get(piece);
		}
		current.set(pieces.at(-1), value);
	}
	const build = (map) => {
		const rows = [];
		for (const [name, value] of map) {
			if (value instanceof Map)
				rows.push(Buffer.from(`040000 tree ${build(value)}\t${name}\0`));
			else {
				const data = typeof value === "string" ? value : value.data;
				const mode = typeof value === "string" ? "100644" : value.mode;
				rows.push(
					Buffer.from(
						`${mode} blob ${oid(cwd, ["hash-object", "-w", "--stdin"], data)}\t${name}\0`,
					),
				);
			}
		}
		return oid(cwd, ["mktree", "-z"], Buffer.concat(rows));
	};
	return build(node);
}
function rootTree(cwd, appTree) {
	const trusted = tree(cwd, {
		"README.md": "MANAGEMENT ROOT\n",
		"scripts/trusted.mjs": "TRUSTED SIGNER\n",
		".github/workflows/release.yml": "TRUSTED WORKFLOW\n",
		"odd\troot\n한국어": "ODD ROOT BYTES\n",
		"root-link": { mode: "120000", data: "scripts/trusted.mjs" },
	});
	return oid(
		cwd,
		["mktree", "-z"],
		Buffer.concat([
			git(cwd, ["ls-tree", "-z", trusted]),
			Buffer.from(`040000 tree ${appTree}\tapp\0`),
		]),
	);
}
function commit(cwd, sourceTree, parents = []) {
	return oid(
		cwd,
		["commit-tree", sourceTree, ...parents.flatMap((parent) => ["-p", parent])],
		"fixture\n",
	);
}
function install(cwd, root) {
	const head = commit(cwd, root);
	git(cwd, ["update-ref", "refs/heads/main", head]);
	git(cwd, ["reset", "--hard", "--quiet", head]);
	return head;
}
async function state(cwd) {
	return {
		head: oid(cwd, ["rev-parse", "HEAD"]),
		refs: git(cwd, ["show-ref"]).toString(),
		index: await fs.readFile(path.join(cwd, ".git/index")),
		status: git(cwd, ["status", "--porcelain=v1", "-z"]).toString(),
		readme: await fs.readFile(path.join(cwd, "README.md")),
		draft: await fs
			.readFile(path.join(cwd, "local-draft.txt"))
			.catch(() => null),
	};
}
function api() {
	assert.equal(
		typeof integration.integrateTrees,
		"function",
		"production integrateTrees is exported",
	);
	return integration.integrateTrees;
}
const english = Array.from({ length: 22 }, (_, i) => `line ${i + 1}\n`).join(
	"",
);
const korean = english.replace("line 1\n", "첫 줄\n");
const upgraded = english.replace("line 20\n", "upstream new behavior\n");

test("explicit snapshot merge preserves Korean overlay and all trusted root entries across unrelated release history", async (t) => {
	const integrateTrees = api();
	const cwd = await fixture(t);
	const baseSourceTree = tree(cwd, {
		"desktop/messages.txt": english,
		"deleted.txt": "old upstream file\n",
	});
	const nextSourceTree = tree(cwd, {
		"desktop/messages.txt": upgraded,
		"new.txt": "new upstream file\n",
		".github/workflows/untrusted.yml": "UPSTREAM ONLY\n",
	});
	const unrelated = commit(
		cwd,
		tree(cwd, { "unrelated.txt": "SIDE HISTORY\n" }),
	);
	const release = commit(cwd, nextSourceTree, [unrelated]);
	const head = install(
		cwd,
		rootTree(
			cwd,
			tree(cwd, {
				"desktop/messages.txt": korean,
				"deleted.txt": "old upstream file\n",
				"korean-only.txt": "번역 도구\n",
			}),
		),
	);
	assert.throws(() => git(cwd, ["merge-base", head, release]));
	await fs.writeFile(path.join(cwd, "README.md"), "UNCOMMITTED ROOT DRAFT\n");
	await fs.writeFile(
		path.join(cwd, "local-draft.txt"),
		"UNTRACKED USER DRAFT\n",
	);
	const before = await state(cwd);
	const merged = await integrateTrees({ cwd, baseSourceTree, nextSourceTree });
	assert.match(merged, /^[0-9a-f]{40}$/);
	assert.equal(
		git(cwd, ["show", `${merged}:app/desktop/messages.txt`]).toString(),
		korean.replace("line 20\n", "upstream new behavior\n"),
	);
	assert.equal(
		git(cwd, ["show", `${merged}:app/korean-only.txt`]).toString(),
		"번역 도구\n",
	);
	assert.equal(
		git(cwd, ["show", `${merged}:app/new.txt`]).toString(),
		"new upstream file\n",
	);
	assert.throws(() =>
		git(cwd, ["cat-file", "-e", `${merged}:app/deleted.txt`]),
	);
	assert.equal(
		git(cwd, [
			"show",
			`${merged}:app/.github/workflows/untrusted.yml`,
		]).toString(),
		"UPSTREAM ONLY\n",
	);
	const withoutApp = (sourceTree) =>
		git(cwd, ["ls-tree", "-z", sourceTree])
			.toString()
			.split("\0")
			.filter((row) => row && !row.endsWith("\tapp"));
	assert.deepEqual(withoutApp(merged), withoutApp(`${head}^{tree}`));
	assert.deepEqual(await state(cwd), before);
});
test("translation conflicts return structured file identities and leave main/index/worktree unchanged", async (t) => {
	const integrateTrees = api();
	const cwd = await fixture(t);
	const baseSourceTree = tree(cwd, { "한국어\t충돌\n문구.txt": "Hello\n" });
	const nextSourceTree = tree(cwd, {
		"한국어\t충돌\n문구.txt": "New English copy\n",
	});
	install(
		cwd,
		rootTree(cwd, tree(cwd, { "한국어\t충돌\n문구.txt": "안녕하세요\n" })),
	);
	await fs.writeFile(path.join(cwd, "local-draft.txt"), "KEEP DRAFT\n");
	const before = await state(cwd);
	await assert.rejects(
		() => integrateTrees({ cwd, baseSourceTree, nextSourceTree }),
		(error) => {
			assert.equal(error.code, "MERGE_CONFLICT");
			assert.deepEqual(error.conflicts, ["app/한국어\t충돌\n문구.txt"]);
			assert.match(error.tree, /^[0-9a-f]{40}$/);
			return true;
		},
	);
	assert.deepEqual(await state(cwd), before);
});
test("source inputs must be full tree identities, not option/ref/program text", async (t) => {
	const integrateTrees = api();
	const cwd = await fixture(t);
	const baseSourceTree = tree(cwd, { "file.txt": "base\n" });
	const head = install(cwd, rootTree(cwd, baseSourceTree));
	const before = await state(cwd);
	for (const bad of [
		"HEAD",
		"--help",
		"x;touch INJECTED",
		"a".repeat(39),
		head,
	]) {
		await assert.rejects(
			() =>
				integrateTrees({
					cwd,
					baseSourceTree: bad,
					nextSourceTree: baseSourceTree,
				}),
			{ code: "INVALID_SOURCE_TREE" },
		);
	}
	assert.deepEqual(await state(cwd), before);
});
test("missing management app tree fails closed instead of replacing a root file", async (t) => {
	const integrateTrees = api();
	const cwd = await fixture(t);
	const baseSourceTree = tree(cwd, { "file.txt": "source\n" });
	install(
		cwd,
		tree(cwd, { app: "ROOT FILE MUST NOT DISAPPEAR\n", "README.md": "KEEP\n" }),
	);
	const before = await state(cwd);
	await assert.rejects(
		() =>
			integrateTrees({ cwd, baseSourceTree, nextSourceTree: baseSourceTree }),
		{ code: "INVALID_APP_ROOT" },
	);
	assert.deepEqual(await state(cwd), before);
});

test("ambient Git repository redirection cannot change the integration repository", async (t) => {
	const integrateTrees = api();
	const cwd = await fixture(t);
	const foreign = await fixture(t);
	const baseSourceTree = tree(cwd, { "file.txt": "base\n" });
	const nextSourceTree = tree(cwd, { "file.txt": "next\n" });
	install(cwd, rootTree(cwd, baseSourceTree));
	tree(foreign, { "file.txt": "base\n" });
	tree(foreign, { "file.txt": "next\n" });
	install(
		foreign,
		tree(foreign, { "app/file.txt": "base\n", "README.md": "FOREIGN ROOT\n" }),
	);
	const original = {
		GIT_DIR: process.env.GIT_DIR,
		GIT_WORK_TREE: process.env.GIT_WORK_TREE,
		GIT_INDEX_FILE: process.env.GIT_INDEX_FILE,
	};
	const before = await state(cwd);
	const foreignBefore = await state(foreign);
	try {
		process.env.GIT_DIR = path.join(foreign, ".git");
		process.env.GIT_WORK_TREE = foreign;
		process.env.GIT_INDEX_FILE = path.join(foreign, ".git/index");
		const merged = await integrateTrees({
			cwd,
			baseSourceTree,
			nextSourceTree,
		});
		assert.equal(
			git(cwd, ["show", `${merged}:README.md`]).toString(),
			"MANAGEMENT ROOT\n",
		);
		assert.equal(
			git(cwd, ["show", `${merged}:app/file.txt`]).toString(),
			"next\n",
		);
	} finally {
		for (const [key, value] of Object.entries(original)) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
	}
	assert.deepEqual(await state(cwd), before);
	assert.deepEqual(await state(foreign), foreignBefore);
});

test("replacement refs cannot substitute content for a pinned source tree", async (t) => {
	const integrateTrees = api();
	const cwd = await fixture(t);
	const baseSourceTree = tree(cwd, { "file.txt": "base\n" });
	const nextSourceTree = tree(cwd, { "file.txt": "pinned next\n" });
	const replacement = tree(cwd, { "file.txt": "REPLACED UNPINNED BYTES\n" });
	const realHead = install(cwd, rootTree(cwd, baseSourceTree));
	const replacedHead = commit(
		cwd,
		tree(cwd, {
			"app/file.txt": "base\n",
			"README.md": "REPLACED MANAGEMENT ROOT\n",
		}),
	);
	git(cwd, ["replace", nextSourceTree, replacement]);
	git(cwd, ["replace", realHead, replacedHead]);
	const before = await state(cwd);
	const merged = await integrateTrees({ cwd, baseSourceTree, nextSourceTree });
	assert.equal(
		git(cwd, [
			"--no-replace-objects",
			"show",
			`${merged}:app/file.txt`,
		]).toString(),
		"pinned next\n",
	);
	assert.equal(
		git(cwd, [
			"--no-replace-objects",
			"show",
			`${merged}:README.md`,
		]).toString(),
		"MANAGEMENT ROOT\n",
	);
	assert.deepEqual(await state(cwd), before);
});

test("bounded Git output aborts the subprocess without modifying main", async (t) => {
	const integrateTrees = api();
	const cwd = await fixture(t);
	const source = tree(cwd, { "file.txt": "base\n" });
	install(cwd, rootTree(cwd, source));
	const before = await state(cwd);
	const bin = await fs.mkdtemp(
		path.join(os.tmpdir(), "buzz-korean-git-output-test-"),
	);
	t.after(() => fs.rm(bin, { recursive: true, force: true }));
	const executable = path.join(bin, "git");
	await fs.writeFile(
		executable,
		`#!${process.execPath}\nprocess.stdout.write(Buffer.alloc(9*1024*1024,120));setInterval(()=>{},1000);\n`,
		{ mode: 0o755 },
	);
	const originalPath = process.env.PATH;
	try {
		process.env.PATH = `${bin}${path.delimiter}${originalPath}`;
		await assert.rejects(
			() =>
				integrateTrees({ cwd, baseSourceTree: source, nextSourceTree: source }),
			{ code: "GIT_OUTPUT_LIMIT" },
		);
	} finally {
		process.env.PATH = originalPath;
	}
	assert.deepEqual(await state(cwd), before);
});

test("an explicit management head is pinned and repeated integration is deterministic", async (t) => {
	const integrateTrees = api();
	const cwd = await fixture(t);
	const source = tree(cwd, { "file.txt": "source\n" });
	const pinnedHead = install(cwd, rootTree(cwd, source));
	const newerHead = commit(
		cwd,
		tree(cwd, {
			"app/file.txt": "source\n",
			"README.md": "LATER MANAGEMENT ROOT\n",
		}),
		[pinnedHead],
	);
	git(cwd, ["update-ref", "refs/heads/main", newerHead]);
	const before = await state(cwd);
	const first = await integrateTrees({
		cwd,
		baseSourceTree: source,
		nextSourceTree: source,
		head: pinnedHead,
	});
	const second = await integrateTrees({
		cwd,
		baseSourceTree: source,
		nextSourceTree: source,
		head: pinnedHead,
	});
	assert.equal(first, second);
	assert.equal(first, oid(cwd, ["rev-parse", `${pinnedHead}^{tree}`]));
	assert.equal(
		git(cwd, ["show", `${first}:README.md`]).toString(),
		"MANAGEMENT ROOT\n",
	);
	assert.deepEqual(await state(cwd), before);
});

test("Git timeout terminates its process group, including a pipe-holding descendant", {
	timeout: 40000,
}, async (t) => {
	const integrateTrees = api();
	const cwd = await fixture(t);
	const source = tree(cwd, { "file.txt": "base\n" });
	install(cwd, rootTree(cwd, source));
	const before = await state(cwd);
	const bin = await fs.mkdtemp(
		path.join(os.tmpdir(), "buzz-korean-git-timeout-test-"),
	);
	const marker = path.join(bin, "owned-pids.json");
	const token = path.basename(bin);
	const originalPath = process.env.PATH;
	const command = `#!${process.execPath}\nconst {spawn}=require('node:child_process');const fs=require('node:fs');const child=spawn(process.execPath,['-e',${JSON.stringify(`setInterval(()=>{},1000); // ${token}`)}],{stdio:'inherit'});fs.writeFileSync(${JSON.stringify(marker)},JSON.stringify([process.pid,child.pid]));setInterval(()=>{},1000);\n`;
	await fs.writeFile(path.join(bin, "git"), command, { mode: 0o755 });
	t.after(async () => {
		const pids = await fs
			.readFile(marker, "utf8")
			.then(JSON.parse)
			.catch(() => []);
		for (const pid of pids) {
			try {
				const args = execFileSync("ps", ["-p", String(pid), "-o", "command="], {
					timeout: 1000,
					stdio: ["ignore", "pipe", "pipe"],
				}).toString();
				if (args.includes(token)) process.kill(pid, "SIGKILL");
			} catch {}
		}
		await fs.rm(bin, { recursive: true, force: true });
	});
	try {
		process.env.PATH = `${bin}${path.delimiter}${originalPath}`;
		await assert.rejects(
			() =>
				integrateTrees({ cwd, baseSourceTree: source, nextSourceTree: source }),
			{ code: "GIT_TIMEOUT" },
		);
	} finally {
		process.env.PATH = originalPath;
	}
	const pids = JSON.parse(await fs.readFile(marker, "utf8"));
	assert.equal(pids.length, 2);
	for (const pid of pids) {
		let status = "";
		try {
			status = execFileSync("ps", ["-p", String(pid), "-o", "stat="], {
				timeout: 1000,
				stdio: ["ignore", "pipe", "pipe"],
			})
				.toString()
				.trim();
		} catch (error) {
			assert.equal(error.status, 1);
		}
		assert.ok(
			!status || status.startsWith("Z"),
			`owned process ${pid} must not remain running: ${status}`,
		);
	}
	assert.deepEqual(await state(cwd), before);
});
