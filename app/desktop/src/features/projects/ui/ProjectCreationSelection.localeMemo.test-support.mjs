import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import * as i18n from "@/shared/i18n";
import * as projectModels from "../projectModels.ts";
import { CreateProjectWorkItemDialog } from "./CreateProjectWorkItemDialog.tsx";
const read = (name) => fs.readFileSync(new URL(name, import.meta.url), "utf8");
const view = ts.createSourceFile(
  "ProjectsView.tsx",
  read("./ProjectsView.tsx"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
let projectsFactory;
function visit(node) {
  if (
    ts.isVariableDeclaration(node) &&
    node.name.getText(view) === "projects" &&
    node.initializer
  ) {
    assert.equal(projectsFactory, undefined);
    projectsFactory = node.initializer.getText(view);
  }
  ts.forEachChild(node, visit);
}
visit(view);
assert.ok(projectsFactory);
export const useProductionProjects = vm.runInNewContext(
  `(function(projectReadModels){return ${projectsFactory};})`,
  {
    React,
    useLocaleMemo: i18n.useLocaleMemo,
    isExplicitProject: projectModels.isExplicitProject,
  },
);
const branches = [
  { name: "main", commit: "MAIN_HASH" },
  { name: "feature", commit: "FEATURE_HASH" },
  { name: "release", commit: "RELEASE_HASH" },
];
export function productionCreationDialog(kind, created, control = {}) {
  const name =
    kind === "issue" ? "CreateProjectIssueDialog" : "CreatePullRequestDialog";
  const exports = {};
  const mutation = (repository) => ({
    isPending: false,
    mutateAsync: async (input) => {
      created.push({ repository, input });
      return "CREATED_ID";
    },
  });
  const stubs = {
    react: React,
    "react/jsx-runtime": jsxRuntime,
    "@/shared/i18n": i18n,
    sonner: { toast: { success() {} } },
    "@/features/projects/projectModels": projectModels,
    "./CreateProjectWorkItemDialog": { CreateProjectWorkItemDialog },
    "@/features/projects/issueMutations": {
      useCreateProjectIssueMutation: mutation,
    },
    "@/features/projects/pullRequestMutations": {
      useCreateProjectPullRequestMutation: mutation,
    },
    "@/features/projects/hooks": {
      useRepoStateQuery: () => ({
        data: { branches: control.branches ?? branches },
      }),
      useProjectPullRequestsQuery: () => ({ data: control.pullRequests ?? [] }),
    },
    "@/features/projects/repoSyncHooks": {
      useProjectRepoSyncStatusQuery: () => ({
        data: { localBranch: "feature", mergeBase: "MERGE_BASE" },
      }),
    },
  };
  vm.runInNewContext(
    ts.transpileModule(read(`./${name}.tsx`), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports,
      require(key) {
        assert.ok(key in stubs, `unmocked creation dependency ${key}`);
        return stubs[key];
      },
    },
  );
  return exports[name];
}
