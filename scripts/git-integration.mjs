import { spawn } from "node:child_process";
import { devNull } from "node:os";

const OBJECT_ID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const TIMEOUT_MS = 30_000;
const OUTPUT_LIMIT = 8 * 1024 * 1024;
const GIT_OPTIONS = [
	"--no-replace-objects",
	"-c",
	`core.hooksPath=${devNull}`,
	"-c",
	"commit.gpgSign=false",
	"-c",
	"core.fsmonitor=false",
	"-c",
	`core.attributesFile=${devNull}`,
	"-c",
	"merge.renormalize=false",
];

/** A bounded Git operation failed before any branch/index/worktree update. */
export class GitIntegrationError extends Error {
	constructor(code, message, details = {}) {
		super(message);
		this.name = "GitIntegrationError";
		this.code = code;
		Object.assign(this, details);
	}
}

/** Conflicting app paths require explicit review; the conflict tree is inspection-only. */
export class GitIntegrationConflict extends GitIntegrationError {
	constructor(tree, pathBytes) {
		super(
			"MERGE_CONFLICT",
			"Upstream source conflicts with the Korean overlay.",
			{
				tree,
				conflicts: pathBytes.map((path) => path.toString("utf8")),
				conflictPathsBase64: pathBytes.map((path) => path.toString("base64")),
			},
		);
		this.name = "GitIntegrationConflict";
	}
}

function runGit(cwd, args, input = Buffer.alloc(0), accepted = [0]) {
	if (input.length > OUTPUT_LIMIT)
		return Promise.reject(
			new GitIntegrationError(
				"GIT_INPUT_LIMIT",
				"Git input exceeds the bounded tree-entry limit.",
			),
		);
	return new Promise((resolve, reject) => {
		const child = spawn("git", [...GIT_OPTIONS, ...args], {
			cwd,
			shell: false,
			detached: process.platform !== "win32",
			stdio: ["pipe", "pipe", "pipe"],
			env: {
				...Object.fromEntries(
					Object.entries(process.env).filter(
						([key]) => !key.startsWith("GIT_"),
					),
				),
				GIT_CONFIG_NOSYSTEM: "1",
				GIT_CONFIG_GLOBAL: devNull,
				GIT_ATTR_NOSYSTEM: "1",
				GIT_TERMINAL_PROMPT: "0",
				GIT_AUTHOR_NAME: "Buzz Korean source integration",
				GIT_AUTHOR_EMAIL: "source-integration@users.noreply.github.com",
				GIT_COMMITTER_NAME: "Buzz Korean source integration",
				GIT_COMMITTER_EMAIL: "source-integration@users.noreply.github.com",
				GIT_AUTHOR_DATE: "2000-01-01T00:00:00Z",
				GIT_COMMITTER_DATE: "2000-01-01T00:00:00Z",
			},
		});
		const stdout = [];
		const stderr = [];
		let size = 0;
		let failure = null;
		const terminate = () => {
			try {
				if (process.platform === "win32") child.kill("SIGKILL");
				else if (child.pid) process.kill(-child.pid, "SIGKILL");
			} catch (error) {
				if (error.code !== "ESRCH") failure ??= error;
			}
		};
		const timer = setTimeout(() => {
			failure = new GitIntegrationError(
				"GIT_TIMEOUT",
				"Git operation exceeded 30 seconds.",
			);
			terminate();
		}, TIMEOUT_MS);
		const capture = (target, chunk) => {
			size += chunk.length;
			if (size > OUTPUT_LIMIT) {
				failure ??= new GitIntegrationError(
					"GIT_OUTPUT_LIMIT",
					"Git operation exceeded the output limit.",
				);
				terminate();
				return;
			}
			target.push(chunk);
		};
		child.stdout.on("data", (chunk) => capture(stdout, chunk));
		child.stderr.on("data", (chunk) => capture(stderr, chunk));
		child.stdin.on("error", (error) => {
			if (error.code !== "EPIPE") {
				failure ??= error;
				terminate();
			}
		});
		child.on("error", (error) => {
			clearTimeout(timer);
			reject(
				new GitIntegrationError("GIT_SPAWN_FAILED", "Could not start Git.", {
					cause: error,
				}),
			);
		});
		child.on("close", (status, signal) => {
			clearTimeout(timer);
			if (failure) return reject(failure);
			const result = {
				status,
				stdout: Buffer.concat(stdout),
				stderr: Buffer.concat(stderr),
			};
			if (!accepted.includes(status))
				return reject(
					new GitIntegrationError(
						"GIT_COMMAND_FAILED",
						"Git operation failed.",
						{
							status,
							signal,
							diagnostic: result.stderr.subarray(0, 2048).toString("utf8"),
						},
					),
				);
			resolve(result);
		});
		child.stdin.end(input);
	});
}

function splitNull(buffer) {
	const result = [];
	let start = 0;
	for (let index = 0; index < buffer.length; index++) {
		if (buffer[index] !== 0) continue;
		result.push(buffer.subarray(start, index));
		start = index + 1;
	}
	if (start < buffer.length) result.push(buffer.subarray(start));
	return result;
}
function treeEntries(buffer) {
	return splitNull(buffer)
		.filter((row) => row.length)
		.map((raw) => {
			const tab = raw.indexOf(9);
			if (tab < 0)
				throw new GitIntegrationError(
					"INVALID_TREE_OUTPUT",
					"Git returned an invalid tree entry.",
				);
			return {
				raw,
				name: raw.subarray(tab + 1),
				metadata: raw.subarray(0, tab).toString("ascii"),
			};
		});
}
const isApp = (entry) => entry.name.equals(Buffer.from("app"));
async function objectId(cwd, args, input) {
	const { stdout } = await runGit(cwd, args, input);
	const value = stdout.toString("ascii").trim();
	if (!OBJECT_ID.test(value))
		throw new GitIntegrationError(
			"INVALID_GIT_OBJECT",
			"Git did not return a full object identity.",
		);
	return value;
}
async function validateSourceTree(cwd, value) {
	if (typeof value !== "string" || !OBJECT_ID.test(value))
		throw new GitIntegrationError(
			"INVALID_SOURCE_TREE",
			"Source snapshots require full Git tree identities.",
		);
	const { stdout, status } = await runGit(
		cwd,
		["cat-file", "-t", value],
		undefined,
		[0, 128],
	);
	if (status !== 0 || stdout.toString("ascii").trim() !== "tree")
		throw new GitIntegrationError(
			"INVALID_SOURCE_TREE",
			"Source snapshot does not identify an available Git tree.",
		);
}

/** Merge only app/ against an explicit source snapshot, returning a tree without changing refs, index or files. */
export async function integrateTrees({
	cwd,
	baseSourceTree,
	nextSourceTree,
	head = "HEAD",
}) {
	await validateSourceTree(cwd, baseSourceTree);
	await validateSourceTree(cwd, nextSourceTree);
	if (
		typeof head !== "string" ||
		!head.length ||
		head.length > 1024 ||
		/[\0\r\n]/.test(head)
	)
		throw new GitIntegrationError(
			"INVALID_HEAD",
			"Expected one bounded Git revision for the management head.",
		);
	const headCommit = await objectId(cwd, [
		"rev-parse",
		"--verify",
		"--end-of-options",
		`${head}^{commit}`,
	]);
	const headTree = await objectId(cwd, [
		"rev-parse",
		"--verify",
		`${headCommit}^{tree}`,
	]);
	const entries = treeEntries(
		(await runGit(cwd, ["ls-tree", "-z", headTree])).stdout,
	);
	const app = entries.find(isApp);
	if (!app || !/^040000 tree [0-9a-f]+$/.test(app.metadata))
		throw new GitIntegrationError(
			"INVALID_APP_ROOT",
			"Management HEAD must contain an app directory tree.",
		);
	const rootRows = entries
		.filter((entry) => !isApp(entry))
		.map((entry) => Buffer.concat([entry.raw, Buffer.from([0])]));
	const replaceApp = (tree) =>
		objectId(
			cwd,
			["mktree", "-z"],
			Buffer.concat([...rootRows, Buffer.from(`040000 tree ${tree}\tapp\0`)]),
		);
	const baseRoot = await replaceApp(baseSourceTree);
	const nextRoot = await replaceApp(nextSourceTree);
	const baseCommit = await objectId(
		cwd,
		["commit-tree", baseRoot],
		Buffer.from("Source snapshot comparison base\n"),
	);
	const ours = await objectId(
		cwd,
		["commit-tree", headTree, "-p", baseCommit],
		Buffer.from("Current Korean source comparison\n"),
	);
	const theirs = await objectId(
		cwd,
		["commit-tree", nextRoot, "-p", baseCommit],
		Buffer.from("Next upstream source comparison\n"),
	);
	const result = await runGit(
		cwd,
		[
			"merge-tree",
			"--write-tree",
			`--merge-base=${baseCommit}`,
			"--name-only",
			"-z",
			ours,
			theirs,
		],
		undefined,
		[0, 1],
	);
	const fields = splitNull(result.stdout);
	const merged = fields[0]?.toString("ascii");
	if (!merged || !OBJECT_ID.test(merged))
		throw new GitIntegrationError(
			"INVALID_MERGE_OUTPUT",
			"Git merge did not return a tree identity.",
		);
	if (result.status === 1) {
		const paths = [];
		for (const field of fields.slice(1)) {
			if (!field.length) break;
			paths.push(field);
		}
		if (!paths.length)
			throw new GitIntegrationError(
				"INVALID_MERGE_OUTPUT",
				"Conflicting merge omitted its path identities.",
			);
		throw new GitIntegrationConflict(merged, paths);
	}
	const mergedEntries = treeEntries(
		(await runGit(cwd, ["ls-tree", "-z", merged])).stdout,
	);
	const preserved = mergedEntries
		.filter((entry) => !isApp(entry))
		.map((entry) => Buffer.concat([entry.raw, Buffer.from([0])]));
	if (!Buffer.concat(rootRows).equals(Buffer.concat(preserved)))
		throw new GitIntegrationError(
			"ROOT_CHANGED",
			"Source integration attempted to change management root entries.",
		);
	return merged;
}
