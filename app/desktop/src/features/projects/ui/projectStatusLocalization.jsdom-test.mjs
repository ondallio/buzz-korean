import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { setLocale } from "@/shared/i18n";
import { ProjectWorkItemContextDetails } from "./ProjectWorkItemContextDetails.tsx";

test("mounted project metadata changes display language without mutating the review status or branch data", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const pullRequest = {
    status: "Open",
    branchName: "feature/my-change",
    targetBranch: "main",
    reviewers: [],
    approvals: [],
  };
  try {
    setLocale("en");
    await act(async () =>
      root.render(
        React.createElement(ProjectWorkItemContextDetails, {
          repository: {},
          pullRequest,
        }),
      ),
    );
    assert.match(container.textContent, /Open/);
    await act(async () => setLocale("ko"));
    assert.match(container.textContent, /열림/);
    assert.match(container.textContent, /feature\/my-change → main/);
    assert.equal(pullRequest.status, "Open");
    await act(async () => setLocale("en"));
    assert.match(container.textContent, /Open/);
    assert.doesNotMatch(container.textContent, /열림/);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    setLocale("en");
  }
});
