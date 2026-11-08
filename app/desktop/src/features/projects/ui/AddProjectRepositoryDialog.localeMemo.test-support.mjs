import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import * as i18n from "@/shared/i18n";
import { normalizePubkey } from "@/shared/lib/pubkey";
import { ownsAuthorAgent } from "@/features/profile/lib/identity";
import { AddProjectRepositoryDialog } from "./AddProjectRepositoryDialog.tsx";

function source(file) {
  const url = new URL(file, import.meta.url);
  return ts.createSourceFile(
    url.pathname,
    fs.readFileSync(url, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
}
const view = source("./ProjectsView.tsx");
const bindings = new Map();
function visit(node) {
  if (
    ts.isVariableDeclaration(node) &&
    node.initializer &&
    ["managedAgentPubkeys", "editableProjects"].includes(
      node.name.getText(view),
    )
  )
    bindings.set(node.name.getText(view), node.initializer.getText(view));
  ts.forEachChild(node, visit);
}
visit(view);
assert.equal(
  bindings.size,
  2,
  "bind actual ProjectsView canonical permission-filter producers",
);
export const useProductionEditableProjects = vm.runInNewContext(
  `(function(projects, currentPubkey) { const managedAgentsQuery = {data:[]}; const profiles = {}; const managedAgentPubkeys = ${bindings.get("managedAgentPubkeys")}; const editableProjects = ${bindings.get("editableProjects")}; return editableProjects; })`,
  {
    React,
    useLocaleMemo: i18n.useLocaleMemo,
    normalizePubkey,
    ownsAuthorAgent,
  },
);

export function productionCategoryCreateDialogs(onAdd) {
  const category = source("./ProjectsCategoryCreateDialogs.tsx");
  const exports = {};
  const stubs = {
    react: React,
    "react/jsx-runtime": jsxRuntime,
    "@/shared/i18n": i18n,
    sonner: { toast: { success() {} } },
    "@/app/navigation/useAppNavigation": {
      useAppNavigation: () => ({
        goProject: async () => {},
        goChannel: async () => {},
      }),
    },
    "@/features/channels/hooks": {
      useChannelsQuery: () => ({
        data: [
          {
            id: "channel-id",
            name: "USER CHANNEL",
            isMember: true,
            channelType: "stream",
          },
        ],
      }),
    },
    "@/features/projects/useAddProjectChannel": {
      useAddProjectChannelMutation: () => ({ isPending: false }),
    },
    "@/features/projects/useAddProjectRepository": {
      useAddProjectRepositoryMutation: () => ({
        isPending: false,
        mutateAsync: onAdd,
      }),
    },
    "@/features/projects/ui/AddProjectRepositoryDialog": {
      AddProjectRepositoryDialog,
    },
    "@/features/sidebar/ui/CreateChannelDialog": {
      CreateChannelDialog: () => null,
    },
  };
  vm.runInNewContext(
    ts.transpileModule(category.text, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports,
      require(name) {
        assert.ok(name in stubs, `unmocked production category import ${name}`);
        return stubs[name];
      },
    },
  );
  return exports.ProjectsCategoryCreateDialogs;
}
