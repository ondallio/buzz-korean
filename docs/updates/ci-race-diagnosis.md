# Existing buzz-db unit-test race

Investigated on 2026-11-09 without changing application source, tests, Git refs,
or the original localization workspace. All test outputs below are from the
current maintained `app/` source and its private build cache.

## Failure and source provenance

The full `just ci` log `/private/tmp/buzz-korean-link-repair-ci.log` has one
failed buzz-db unit test:

`runtime::observability::tests::waiter_refresh_omits_reader_pairs_when_no_reader_pool_is_configured`

At `app/crates/buzz-db/src/runtime/observability.rs:997`, the gauge assertion
expects `0.0` but observes `1.0`. The crate result is 190 passed, 1 failed,
667 ignored. This is not a database connection failure. Other intentional
panic messages in the full log belong to passing tests.

Both relevant files exactly match the verified official source commit
`ff6ab96e42b1fc64bfc1236104478a84e11b5abd`:

| File under app/ | Current and official Git blob SHA-1 |
| --- | --- |
| crates/buzz-db/src/runtime/observability.rs | 6117eb78357cd9b70a43a4a6c4884012f3b5b770 |
| crates/buzz-db/src/runtime/tests.rs | b7c9d5fe2ac7e4f3ea5d09df80c58b2784a8fb63 |

The clipboard/link changes do not change either file or these metrics.

## Cause

`POOL_WAITERS` in `observability.rs:347` is process-global. Acquisition starts
increment a slot at lines 434–438; terminal/drop paths decrement it.
`refresh_pool_waiters` at lines 400–409 publishes the current shared value.

The failing test takes `POOL_METRICS_TEST_LOCK` and assumes every writer slot
is zero. Other tests in `runtime/tests.rs` acquire through production helpers
without taking that lock. Concrete examples are
`fleet_sweep_stops_at_first_unavailable_connection` (line 85),
`event_write_transaction_preserves_legacy_acquisition_metrics` (line 110), and
`community_write_transaction_compatibility_metrics_are_limited_to_legacy_entrypoints`
(line 188). Closed lazy pools still create a `PoolAcquireAttempt` before SQLx
returns `PoolClosed`. Consequently a concurrent zero-snapshot can legitimately
see another test's outstanding writer acquisition. Thread-local metrics
recorders isolate recorded series, not the process-global waiter array.

The original failure does not identify which writer operation was sampled,
so it cannot establish a unique competing test. The shared-state overlap and
its timing-sensitive failure were reproduced with the unchanged production
test binary; no instrumentation or assertion changes were needed.

## Reproduction and verification

Commands ran from `/Users/stan/orca/buzz-korean/app`, after
`. ./bin/activate-hermit`. `app/target` was verified to resolve to
`/Users/stan/orca/buzz-korean/.local/build-cache/workspace-target`; the original
workspace cache was not used or modified.

- Isolated failing test: 1 passed.
  `/private/tmp/buzz-db-waiter-single.log`.
- Whole crate with default parallelism: 191 passed, 667 ignored in 0.41 s.
  `/private/tmp/buzz-db-waiter-full-parallel.log`.
- Bounded repeat of the same current test binary, at most 20 runs and a
  30-second timeout per run: runs 1–19 passed; run 20 reproduced the exact
  same test, line, and `1.0` versus `0.0` failure (190 passed, 1 failed).
  `/private/tmp/buzz-db-waiter-repeat.log`.
- Whole crate with `--test-threads=1`: 191 passed, 667 ignored in 0.58 s.
  `/private/tmp/buzz-db-waiter-full-serial.log`.
- Whole crate with the proposed environment alone:
  `RUST_TEST_THREADS=1 cargo test -p buzz-db --lib -- --nocapture`:
  191 passed, 667 ignored in 0.58 s.
  `/private/tmp/buzz-db-waiter-env-serial.log`.

The isolated command was:

```sh
cargo test -p buzz-db --lib runtime::observability::tests::waiter_refresh_omits_reader_pairs_when_no_reader_pool_is_configured -- --exact --nocapture
```

The bounded repetition invoked the exact current private-cache binary
`target/debug/deps/buzz_db-6a91d37acbb606b7 --nocapture`, stopped at its first
failure, and capped captured failing output at 600,000 bytes.

## Safe rerun

For the existing Cargo/libtest CI fallback, setting `RUST_TEST_THREADS=1`
serializes test cases in each process while preserving every test and
assertion. Tests that explicitly create threads or concurrent Tokio tasks
still exercise those concurrent paths. This directly removes this cross-test
shared-state overlap. It does not change app runtime behavior or data.

The tradeoff is a potentially longer full Rust test suite; the measured
buzz-db increase is 0.41 s to 0.58 s, not an estimate for the whole repository.
This setting is not a general guarantee against a test's own async or child
process races. Explicit libtest `--test-threads` arguments take precedence.
The optional nextest branch has separate scheduling and process-per-test
isolation; `RUST_TEST_THREADS` should not be represented as its scheduling
control. The failing run used `scripts/run-tests.sh`'s Cargo fallback.

Recommended full rerun, performed by the coordinator:

```sh
cd /Users/stan/orca/buzz-korean/app
. ./bin/activate-hermit
RUST_TEST_THREADS=1 just ci
```

The full `just ci` result remains pending until that new command completes.
No failed check is counted as passed by these targeted reruns. A permanent
upstream repair would make all process-global waiter-mutating tests share
the same test guard or isolate their state; this diagnosis does not change
the unchanged upstream server code.
