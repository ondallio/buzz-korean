const VERSION = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
const OBJECT_ID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;

function reject(code, message) {
	const error = new Error(message);
	error.code = code;
	throw error;
}

/** Parse a canonical numeric X.Y.Z version without unsafe integer rounding. */
export function parseVersion(value) {
	const match = typeof value === "string" ? VERSION.exec(value) : null;
	if (!match || match[0] !== value)
		reject("INVALID_VERSION", "Expected a canonical numeric X.Y.Z version.");
	const [major, minor, patch] = match.slice(1).map(Number);
	if (![major, minor, patch].every(Number.isSafeInteger))
		reject("INVALID_VERSION", "Version components exceed safe numeric limits.");
	return { major, minor, patch };
}

/** Select the numerically greatest published stable desktop release object. */
export function selectStableRelease(releases) {
	if (!Array.isArray(releases))
		reject("INVALID_RELEASE_LIST", "Expected a complete release-list array.");
	let selected = null;
	let selectedVersion = null;
	for (const release of releases) {
		if (
			release?.draft !== false ||
			release.prerelease !== false ||
			typeof release.tag_name !== "string" ||
			!release.tag_name.startsWith("desktop-v")
		)
			continue;
		let version;
		try {
			version = parseVersion(release.tag_name.slice("desktop-v".length));
		} catch (error) {
			if (error.code === "INVALID_VERSION") continue;
			throw error;
		}
		const order =
			selectedVersion === null
				? 1
				: version.major - selectedVersion.major ||
					version.minor - selectedVersion.minor ||
					version.patch - selectedVersion.patch;
		if (order > 0) {
			selected = release;
			selectedVersion = version;
		}
	}
	return selected;
}

function validPin(value) {
	if (
		!value ||
		typeof value !== "object" ||
		typeof value.tag !== "string" ||
		!value.tag.startsWith("desktop-v") ||
		!OBJECT_ID.test(value.commit ?? "")
	)
		return false;
	try {
		parseVersion(value.tag.slice("desktop-v".length));
	} catch {
		return false;
	}
	return (
		value.tagObject === undefined ||
		(typeof value.tagObject === "string" && OBJECT_ID.test(value.tagObject))
	);
}

/** Refuse tag/peeled-commit changes, including a pinned annotated tag object. */
export function assertTagUnchanged(pinned, observed) {
	if (!validPin(pinned) || !validPin(observed))
		reject(
			"INVALID_TAG_PIN",
			"Tag pins require a canonical desktop tag and full commit identity.",
		);
	if (pinned.tag !== observed.tag)
		reject("TAG_MISMATCH", "Observed tag differs from the pinned release tag.");
	if (
		pinned.commit !== observed.commit ||
		(pinned.tagObject !== undefined && pinned.tagObject !== observed.tagObject)
	)
		reject(
			"TAG_RETARGETED",
			"The pinned release tag changed or its tag object is missing.",
		);
	return observed;
}

function sourceTimestamp(value, now) {
	const match =
		typeof value === "string"
			? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(?:Z|([+-])(\d{2}):(\d{2}))$/.exec(
					value,
				)
			: null;
	if (!match || match[0] !== value)
		reject(
			"INVALID_SOURCE_DATE",
			"Source dates require explicit ISO timestamps with a timezone.",
		);
	const [year, month, day, hour, minute, second] = match
		.slice(1, 7)
		.map(Number);
	const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
	const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
	const timestamp = Date.parse(value);
	if (
		month < 1 ||
		month > 12 ||
		day < 1 ||
		day > days[month - 1] ||
		hour > 23 ||
		minute > 59 ||
		second > 59 ||
		Number(match[9] ?? 0) > 23 ||
		Number(match[10] ?? 0) > 59 ||
		!Number.isFinite(timestamp)
	)
		reject(
			"INVALID_SOURCE_DATE",
			"Source dates contain invalid calendar or timezone values.",
		);
	if (timestamp > now)
		reject("FUTURE_SOURCE_DATE", "Source dates cannot be in the future.");
	return timestamp;
}

/** Check already verified official metadata against a fixed source floor, without requiring Git ancestry. */
export function assertSourceFreshness(candidate, floor) {
	if (
		!candidate ||
		!floor ||
		typeof candidate.sourceCommit !== "string" ||
		typeof floor.sourceCommit !== "string" ||
		!OBJECT_ID.test(candidate.sourceCommit) ||
		!OBJECT_ID.test(floor.sourceCommit)
	)
		reject(
			"INVALID_SOURCE_COMMIT",
			"Source freshness requires full pinned commit identities.",
		);
	const previous = parseVersion(floor.upstreamVersion);
	const next = parseVersion(candidate.upstreamVersion);
	const order =
		next.major - previous.major ||
		next.minor - previous.minor ||
		next.patch - previous.patch;
	if (order <= 0)
		reject(
			"SOURCE_VERSION_NOT_NEWER",
			"Official source version must be strictly newer than the applied source version.",
		);
	if (candidate.sourceCommit === floor.sourceCommit)
		reject(
			"SOURCE_COMMIT_UNCHANGED",
			"A new source release must identify a different verified commit.",
		);
	const now = Date.now();
	const initialFloor = sourceTimestamp(floor.sourceDate, now);
	const commitDate = sourceTimestamp(candidate.commitDate, now);
	const publishedAt = sourceTimestamp(candidate.publishedAt, now);
	if (commitDate < initialFloor || publishedAt < initialFloor)
		reject(
			"SOURCE_BEFORE_FLOOR",
			"Release source and publication dates must not precede the initial verified source snapshot.",
		);
	return candidate;
}
