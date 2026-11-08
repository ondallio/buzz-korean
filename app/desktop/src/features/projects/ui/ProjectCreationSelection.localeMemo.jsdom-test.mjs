import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { fireEvent } from "@testing-library/react";
import { setLocale, useLocale } from "@/shared/i18n";
import { ThemeProvider } from "@/shared/theme/ThemeProvider";
import {
  productionCreationDialog,
  useProductionProjects,
} from "./ProjectCreationSelection.localeMemo.test-support.mjs";
for (const kind of ["issue", "review"]) {
  test(`actual ProjectsView factory language switch preserves ${kind} repository, branches, draft and submit identity`, async () => {
    window.matchMedia = (media) => ({
      media,
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    });
    setLocale("en");
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const created = [];
    const onCreated = [];
    const first = {
      id: "REPO_ONE",
      name: "USER FIRST",
      defaultBranch: "main",
      repoAddress: "repo:1",
    };
    const second = {
      id: "REPO_TWO",
      name: "USER SECOND",
      defaultBranch: "main",
      repoAddress: "repo:2",
    };
    const project = {
      id: "PROJECT_ID",
      name: "USER PROJECT",
      legacy: false,
      primaryRepositoryAddress: "repo:1",
      repositories: [first, second],
    };
    let rawProjects = [project];
    const Dialog = productionCreationDialog(kind, created);
    function ActualCaller() {
      useLocale();
      const projects = useProductionProjects(rawProjects);
      return React.createElement(Dialog, {
        open: true,
        projects,
        onOpenChange() {},
        onCreated: (...args) => onCreated.push(args),
      });
    }
    const render = () =>
      root.render(
        React.createElement(
          ThemeProvider,
          null,
          React.createElement(ActualCaller),
        ),
      );
    const prefix = kind === "issue" ? "create-issue" : "create-pull-request";
    try {
      await act(async () => render());
      const repository = document.querySelector(
        `[data-testid="${prefix}-repository"]`,
      );
      await act(async () =>
        fireEvent.change(repository, { target: { value: "REPO_TWO" } }),
      );
      if (kind === "review") {
        await act(async () =>
          fireEvent.change(
            document.querySelector(
              '[data-testid="create-pull-request-base-branch"]',
            ),
            { target: { value: "release" } },
          ),
        );
        await act(async () =>
          fireEvent.change(
            document.querySelector(
              '[data-testid="create-pull-request-compare-branch"]',
            ),
            { target: { value: "feature" } },
          ),
        );
      }
      const title = document.querySelector(`[data-testid="${prefix}-title"]`);
      await act(async () =>
        fireEvent.change(title, { target: { value: "USER DRAFT 한국어" } }),
      );
      await act(async () => setLocale("ko"));
      assert.equal(repository.value, "REPO_TWO");
      assert.equal(title.value, "USER DRAFT 한국어");
      assert.ok(
        document.querySelector(`[data-testid="${prefix}-repository"]`) ===
          repository,
      );
      if (kind === "review") {
        assert.equal(
          document.querySelector(
            '[data-testid="create-pull-request-base-branch"]',
          ).value,
          "release",
        );
        assert.equal(
          document.querySelector(
            '[data-testid="create-pull-request-compare-branch"]',
          ).value,
          "feature",
        );
      }
      // Fresh equivalent server read models retain intent while new names render.
      rawProjects = [
        {
          ...project,
          repositories: [
            { ...first },
            { ...second, name: "RENAMED USER SECOND" },
          ],
        },
      ];
      await act(async () => render());
      assert.equal(repository.value, "REPO_TWO");
      assert.match(repository.textContent, /RENAMED USER SECOND/);
      if (kind === "review")
        assert.equal(
          document.querySelector(
            '[data-testid="create-pull-request-base-branch"]',
          ).value,
          "release",
        );
      await act(async () =>
        fireEvent.submit(document.querySelector(`#${prefix}-form`)),
      );
      assert.equal(created.length, 1);
      assert.equal(created[0].repository.id, "REPO_TWO");
      assert.equal(created[0].input.title, "USER DRAFT 한국어");
      if (kind === "issue") assert.equal(created[0].input.category, "issue");
      else assert.equal("category" in created[0].input, false);
      assert.equal(onCreated[0][0].id, "PROJECT_ID");
      assert.equal(onCreated[0][1].id, "REPO_TWO");
      if (kind === "review") {
        assert.equal(created[0].input.branch, "feature");
        assert.equal(created[0].input.targetBranch, "release");
        assert.equal(created[0].input.commit, "FEATURE_HASH");
      }
      // Removing the selected repository still selects the remaining target.
      rawProjects = [{ ...project, repositories: [first] }];
      await act(async () => render());
      assert.equal(repository.value, "REPO_ONE");
      if (kind === "review") {
        assert.equal(
          document.querySelector(
            '[data-testid="create-pull-request-base-branch"]',
          ).value,
          "main",
        );
        rawProjects = [
          {
            ...project,
            repositories: [{ ...first, defaultBranch: "release" }],
          },
        ];
        await act(async () => render());
        assert.equal(
          document.querySelector(
            '[data-testid="create-pull-request-base-branch"]',
          ).value,
          "release",
        );
        assert.notEqual(
          document.querySelector(
            '[data-testid="create-pull-request-compare-branch"]',
          ).value,
          "release",
        );
      }
    } finally {
      await act(async () => root.unmount());
      host.remove();
      setLocale("en");
    }
  });
}

for (const [control, english, korean] of [
  [
    { branches: [] },
    "The compare branch must be pushed before opening a review.",
    "리뷰를 열기 전에 비교 브랜치를 푸시해야 합니다.",
  ],
  [
    {
      pullRequests: [
        { status: "Open", branchName: "feature", targetBranch: "main" },
      ],
    },
    "An open review already compares these branches.",
    "이 브랜치를 비교하는 열린 리뷰가 이미 있습니다.",
  ],
]) {
  test(`canonical review validation switches language: ${english}`, async () => {
    setLocale("en");
    window.matchMedia = (media) => ({
      media,
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    });
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const Dialog = productionCreationDialog("review", [], control);
    const repository = {
      id: "USER_REPO",
      name: "USER REPOSITORY",
      repoAddress: "repo:validation",
      defaultBranch: "main",
    };
    try {
      await act(async () =>
        root.render(
          React.createElement(
            ThemeProvider,
            null,
            React.createElement(Dialog, {
              open: true,
              projects: [
                {
                  id: "USER_PROJECT",
                  name: "USER PROJECT",
                  repositories: [repository],
                },
              ],
              onOpenChange() {},
              onCreated() {},
            }),
          ),
        ),
      );
      assert.ok(document.body.textContent.includes(english));
      await act(async () => setLocale("ko"));
      assert.ok(document.body.textContent.includes(korean));
      assert.ok(!document.body.textContent.includes(english));
      assert.equal(
        document.querySelector('[data-testid="create-pull-request-submit"]')
          .disabled,
        true,
      );
      assert.equal(repository.defaultBranch, "main");
    } finally {
      await act(async () => root.unmount());
      host.remove();
      setLocale("en");
    }
  });
}
