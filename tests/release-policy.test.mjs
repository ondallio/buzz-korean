import assert from "node:assert/strict";
import test from "node:test";

const policy = await import("../scripts/release-policy.mjs").catch((error) => {
	if (error.code === "ERR_MODULE_NOT_FOUND") return {};
	throw error;
});
function api(name) {
	assert.equal(
		typeof policy[name],
		"function",
		`production ${name} is exported`,
	);
	return policy[name];
}
const commit = "a".repeat(40);
const release = (tag_name, extra = {}) => ({
	tag_name,
	draft: false,
	prerelease: false,
	...extra,
});

test("version parsing accepts canonical numeric triples", () => {
	assert.deepEqual(api("parseVersion")("0.5.28"), {
		major: 0,
		minor: 5,
		patch: 28,
	});
	assert.deepEqual(api("parseVersion")("1.10.999"), {
		major: 1,
		minor: 10,
		patch: 999,
	});
	assert.deepEqual(api("parseVersion")("0.0.0"), {
		major: 0,
		minor: 0,
		patch: 0,
	});
});
for (const version of [
	"v1.2.3",
	"1.2",
	"1.2.3.4",
	"1.2.3-rc.1",
	"1.2.3+ko.1",
	"01.2.3",
	"1.02.3",
	"1.2.03",
	" 1.2.3",
	"1.2.3\n",
	"1.2.3;exit",
	"-1.2.3",
	"1e2.0.0",
	"9007199254740992.0.0",
	123,
	null,
	undefined,
]) {
	test(`rejects noncanonical or unsafe version ${JSON.stringify(version)}`, () => {
		const parseVersion = api("parseVersion");
		assert.throws(() => parseVersion(version), { code: "INVALID_VERSION" });
	});
}
test("stable desktop release selection orders numerically and keeps the original object", () => {
	const highest = release("desktop-v1.10.0", {
		id: 10,
		published_at: "2020-01-01T00:00:00Z",
	});
	const releases = [
		release("desktop-v1.9.99"),
		highest,
		release("desktop-v1.2.30"),
	];
	const before = JSON.stringify(releases);
	assert.equal(api("selectStableRelease")(releases), highest);
	assert.equal(JSON.stringify(releases), before);
});
test("release selection ignores drafts, prereleases, unrelated and malformed tags", () => {
	const stable = release("desktop-v0.5.28");
	const releases = [
		release("desktop-v99.0.0", { draft: true }),
		release("desktop-v98.0.0", { prerelease: true }),
		release("desktop-v97.0.0", { draft: undefined }),
		release("desktop-v96.0.0", { prerelease: undefined }),
		release("desktop-v95.0.0", { draft: "false" }),
		release("mobile-v99.0.0"),
		release("relay-v99.0.0"),
		release("rolling"),
		release("desktop-v99.0.0-beta.1"),
		release("desktop-v01.0.0"),
		release("desktop-v99.0.0\n"),
		release("desktop-v99.0.0;echo injected"),
		release("desktop-v9007199254740992.0.0"),
		release(12),
		null,
		stable,
	];
	assert.equal(api("selectStableRelease")(releases), stable);
	assert.equal(api("selectStableRelease")([]), null);
	assert.equal(api("selectStableRelease")([release("mobile-v1.0.0")]), null);
});
test("release selection rejects a failed/non-list API response instead of reporting no release", () => {
	const selectStableRelease = api("selectStableRelease");
	assert.throws(() => selectStableRelease({ message: "API failure" }), {
		code: "INVALID_RELEASE_LIST",
	});
});
test("unchanged lightweight or pinned annotated tags retain exact source identity", () => {
	const check = api("assertTagUnchanged");
	const pin = { tag: "desktop-v0.5.28", commit };
	assert.doesNotThrow(() => check(pin, { ...pin, tagObject: commit }));
	const annotated = { ...pin, tagObject: "c".repeat(40) };
	assert.doesNotThrow(() => check(annotated, { ...annotated }));
});
for (const observed of [
	{ tag: "desktop-v0.5.28", commit: "b".repeat(40), tagObject: "c".repeat(40) },
	{ tag: "desktop-v0.5.28", commit, tagObject: "d".repeat(40) },
	{ tag: "desktop-v0.5.28", commit },
]) {
	test("retargeted or missing pinned tag object fails even when the release label is unchanged", () => {
		const check = api("assertTagUnchanged");
		assert.throws(
			() =>
				check(
					{ tag: "desktop-v0.5.28", commit, tagObject: "c".repeat(40) },
					observed,
				),
			{ code: "TAG_RETARGETED" },
		);
	});
}
test("tag comparison rejects wrong tags and missing/malformed commit identities", () => {
	const check = api("assertTagUnchanged");
	const pin = { tag: "desktop-v0.5.28", commit };
	assert.throws(() => check(pin, { ...pin, tag: "desktop-v0.5.29" }), {
		code: "TAG_MISMATCH",
	});
	assert.throws(() => check(pin, { ...pin, commit: "main" }), {
		code: "INVALID_TAG_PIN",
	});
	assert.throws(() => check(pin, null), { code: "INVALID_TAG_PIN" });
});

test("tag pins reject trailing line breaks in full object identities", () => {
	const check = api("assertTagUnchanged");
	const malformed = { tag: "desktop-v0.5.28", commit: `${commit}\n` };
	assert.throws(() => check(malformed, malformed), { code: "INVALID_TAG_PIN" });
	const badObject = {
		tag: "desktop-v0.5.28",
		commit,
		tagObject: `${commit}\n`,
	};
	assert.throws(() => check(badObject, badObject), { code: "INVALID_TAG_PIN" });
});

const floor = {
	sourceCommit: "a".repeat(40),
	sourceDate: "2026-11-03T02:50:08Z",
	upstreamVersion: "0.5.28",
};
const fresh = {
	sourceCommit: "b".repeat(40),
	commitDate: "2026-11-04T02:50:08Z",
	publishedAt: "2026-11-04T04:00:00Z",
	upstreamVersion: "0.5.29",
};
test("newer verified-official caller metadata accepts side-history without ancestry assumptions", () => {
	const validate = api("assertSourceFreshness");
	assert.equal(validate(fresh, floor), fresh);
	assert.doesNotThrow(() =>
		validate(
			{ ...fresh, commitDate: floor.sourceDate, publishedAt: floor.sourceDate },
			floor,
		),
	);
	assert.doesNotThrow(() =>
		validate(
			{
				...fresh,
				commitDate: "2026-11-03T20:00:00-08:00",
				upstreamVersion: "0.6.0",
			},
			floor,
		),
	);
});
for (const [changes, code] of [
	[{ upstreamVersion: "0.5.28" }, "SOURCE_VERSION_NOT_NEWER"],
	[{ upstreamVersion: "0.5.27" }, "SOURCE_VERSION_NOT_NEWER"],
	[{ sourceCommit: floor.sourceCommit }, "SOURCE_COMMIT_UNCHANGED"],
	[{ commitDate: "2026-11-03T02:50:07Z" }, "SOURCE_BEFORE_FLOOR"],
	[{ publishedAt: "2026-11-03T02:50:07Z" }, "SOURCE_BEFORE_FLOOR"],
	[{ commitDate: "2999-01-01T00:00:00Z" }, "FUTURE_SOURCE_DATE"],
	[{ publishedAt: "2999-01-01T00:00:00Z" }, "FUTURE_SOURCE_DATE"],
	[{ commitDate: "2026-11-31T02:50:08Z" }, "INVALID_SOURCE_DATE"],
	[{ commitDate: "2026-11-04" }, "INVALID_SOURCE_DATE"],
	[{ publishedAt: "not a timestamp" }, "INVALID_SOURCE_DATE"],
	[{ publishedAt: undefined }, "INVALID_SOURCE_DATE"],
	[{ commitDate: "2026-11-04T00:00:00+24:00" }, "INVALID_SOURCE_DATE"],
	[{ sourceCommit: "main" }, "INVALID_SOURCE_COMMIT"],
	[{ upstreamVersion: "0.5.29-rc.1" }, "INVALID_VERSION"],
]) {
	test(`rejects stale or malformed official source metadata ${JSON.stringify(changes)}`, () => {
		const validate = api("assertSourceFreshness");
		assert.throws(() => validate({ ...fresh, ...changes }, floor), { code });
	});
}
test("fixed source-floor metadata must itself be a valid nonfuture canonical pin", () => {
	const validate = api("assertSourceFreshness");
	assert.throws(
		() => validate(fresh, { ...floor, sourceDate: "2999-01-01T00:00:00Z" }),
		{ code: "FUTURE_SOURCE_DATE" },
	);
	assert.throws(() => validate(fresh, { ...floor, sourceDate: "missing" }), {
		code: "INVALID_SOURCE_DATE",
	});
	assert.throws(
		() => validate(fresh, { ...floor, sourceCommit: "upstream/main" }),
		{ code: "INVALID_SOURCE_COMMIT" },
	);
});
