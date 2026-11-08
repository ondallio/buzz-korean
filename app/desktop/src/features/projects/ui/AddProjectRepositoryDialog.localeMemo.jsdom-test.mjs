import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { fireEvent } from "@testing-library/react";
import { setLocale, useLocale } from "@/shared/i18n";
import { ThemeProvider } from "@/shared/theme/ThemeProvider";
import { AddProjectRepositoryDialog } from "./AddProjectRepositoryDialog.tsx";
import {
  useProductionEditableProjects,
  productionCategoryCreateDialogs,
} from "./AddProjectRepositoryDialog.localeMemo.test-support.mjs";

for (const category of [false, true]) {
  test(`language change keeps ${category ? "actual category-create caller" : "single-project caller"} repository draft, channel, error, payload`, async () => {
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
    const submitted = [];
    const project = {
      id: "project-id",
      name: "USER PROJECT API_key",
      repositories: [],
      owner: "a".repeat(64),
    };
    const secondProject = {
      ...project,
      id: "second-id",
      name: "SECOND USER PROJECT",
    };
    const allProjects = [project, secondProject];
    const selectedProject = category ? secondProject : project;
    let shouldFail = true;
    async function onAdd(input) {
      submitted.push(input);
      if (shouldFail) throw new Error("RAW DIAGNOSTIC");
      return { repository: { id: "created-id", name: input.name } };
    }
    const Category = productionCategoryCreateDialogs(onAdd);
    function ActualCaller() {
      useLocale();
      const editableProjects = useProductionEditableProjects(
        allProjects,
        "a".repeat(64),
      );
      return category
        ? React.createElement(Category, {
            channelOpen: false,
            editableProjects,
            onChannelOpenChange() {},
            onRepositoryOpenChange() {},
            ownerControlAgentPubkeyFor() {},
            repositoryOpen: true,
          })
        : React.createElement(AddProjectRepositoryDialog, {
            open: true,
            project,
            channels: [{ id: "channel-id", name: "USER CHANNEL" }],
            isCreating: false,
            onOpenChange() {},
            onAdd,
          });
    }
    try {
      await act(async () =>
        root.render(
          React.createElement(
            ThemeProvider,
            null,
            React.createElement(ActualCaller),
          ),
        ),
      );
      const name = document.querySelector(
        '[data-testid="add-project-repository-name"]',
      );
      const clone = document.querySelector(
        '[data-testid="add-project-repository-clone-url"]',
      );
      const channel = document.querySelector(
        '[data-testid="add-project-repository-channel"]',
      );
      if (category)
        await act(async () =>
          fireEvent.change(
            document.querySelector(
              '[data-testid="add-project-repository-project"]',
            ),
            { target: { value: "second-id" } },
          ),
        );
      await act(async () => {
        fireEvent.change(name, { target: { value: "USER REPO 한국어" } });
        fireEvent.change(clone, {
          target: { value: "https://git.example/USER_API.git" },
        });
        fireEvent.change(channel, { target: { value: "channel-id" } });
      });
      const submit = async () =>
        act(async () =>
          fireEvent.submit(
            document.querySelector("#add-project-repository-form"),
          ),
        );
      await submit();
      assert.match(document.body.textContent, /RAW DIAGNOSTIC/);
      await act(async () => setLocale("ko"));
      assert.equal(name.value, "USER REPO 한국어");
      assert.equal(clone.value, "https://git.example/USER_API.git");
      assert.equal(channel.value, "channel-id");
      assert.match(document.body.textContent, /RAW DIAGNOSTIC/);
      assert.ok(
        document.querySelector(
          '[data-testid="add-project-repository-name"]',
        ) === name,
      );
      assert.equal(
        document.querySelector('[data-testid="add-project-repository-submit"]')
          .textContent,
        "저장소 추가",
      );
      shouldFail = false;
      await submit();
      assert.equal(submitted.length, 2);
      assert.deepEqual(
        { ...submitted[1] },
        {
          project: selectedProject,
          ...(category ? { ownerControlAgentPubkey: undefined } : {}),
          name: "USER REPO 한국어",
          cloneUrl: "https://git.example/USER_API.git",
          accessChannelId: "channel-id",
        },
      );
    } finally {
      await act(async () => root.unmount());
      host.remove();
      setLocale("en");
    }
  });
}
