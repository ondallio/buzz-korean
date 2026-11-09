import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import ts from "typescript";
import {
  localeTag,
  setLocale,
  t,
  useLocale,
  useLocaleMemo,
  useTranslation,
} from "./index.ts";
import { formatLocalizedDateTime } from "@/shared/lib/datetime";
import { numericTuningPlaceholder } from "@/features/agents/lib/agentConfigCore";
import { projectHomeWorkspaceSheetTitle } from "@/features/projects/lib/projectHomeWorkspaceSheet";
import {
  EffortSelectField as ActualEffort,
  NumericTuningFields as ActualNumeric,
} from "@/features/agents/ui/buzzAgentModelTuningFields";
import { AgentConfigSurfaceRows as ActualConfigRows } from "@/features/agents/ui/AgentConfigPanel";
import { ChannelHero as ActualChannelHero } from "@/features/channels/ui/ChannelManagementSheetRows";
import { ProjectsWorkItemsLoadNotice as ActualNotice } from "@/features/projects/ui/ProjectsWorkItemsLoadNotice";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { projectsQueryKey } from "@/features/projects/hooks";

const agents = "features/agents/ui/";
const channels = "features/channels/ui/";
const projects = "features/projects/ui/";
function source(path) {
  return ts.createSourceFile(
    path,
    fs.readFileSync(new URL(`../../${path}`, import.meta.url), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
}
function context(bindings = {}) {
  return {
    React,
    Error,
    Date,
    Intl,
    localize: t,
    translateFinalText: t,
    translateInterfaceText: t,
    useAppLocale: useLocale,
    useAppTranslation: useTranslation,
    useLocaleMemo,
    localeTag,
    formatLocalizedDateTime,
    ...bindings,
  };
}
function evaluate(code, bindings) {
  return vm.runInNewContext(
    ts.transpileModule(`(${code})`, {
      compilerOptions: {
        jsx: ts.JsxEmit.React,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    context(bindings),
  );
}
function initializer(path, name, bindings = {}) {
  const tree = source(path);
  const nodes = [];
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name)
      nodes.push(node);
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.equal(nodes.length, 1, `${path} has a unique production ${name}`);
  return evaluate(nodes[0].initializer.getText(tree), bindings);
}
function component(path, name, bindings = {}) {
  const tree = source(path);
  const declarations = tree.statements.filter(
    (node) => ts.isFunctionDeclaration(node) || ts.isVariableStatement(node),
  );
  const code = declarations
    .map((node) => node.getText(tree).replace(/^export\s+/, ""))
    .join("\n");
  const compiled = ts.transpileModule(code, {
    compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return vm.runInNewContext(`${compiled}\n${name}`, context(bindings));
}
function render(Component, props) {
  return new JSDOM(renderToStaticMarkup(React.createElement(Component, props)))
    .window.document;
}
const fragment = ({ children }) =>
  React.createElement(React.Fragment, null, children);
const icon = () => null;
const cn = (...values) => values.filter(Boolean).join(" ");
test.afterEach(() => setLocale("en"));

test("agent flat headers and discovery placeholder use the selected language without changing model data", () => {
  for (const [locale, titles, loading] of [
    ["en", ["Model settings", "MCP servers", "Advanced"], "Loading models..."],
    ["ko", ["모델 설정", "MCP 서버", "고급"], "모델 불러오는 중…"],
  ]) {
    setLocale(locale);
    for (const [index, sections] of [
      [0, ["model"]],
      [1, ["mcp"]],
      [2, []],
    ])
      assert.equal(
        initializer(`${agents}AgentConfigPanel.tsx`, "flatStateTitle", {
          sections,
        }),
        titles[index],
      );
    const bindings = {
      modelDiscoveryLoading: true,
      discoveredModelOptions: null,
      trimmedModel: "",
      isCustomModelEditing: false,
      placeholder: "USER MODEL PROMPT",
    };
    assert.equal(
      initializer(
        `${agents}agentConfigControls.tsx`,
        "restingPlaceholder",
        bindings,
      ),
      loading,
    );
    assert.equal(
      initializer(`${agents}agentConfigControls.tsx`, "restingPlaceholder", {
        ...bindings,
        trimmedModel: "USER MODEL",
      }),
      "USER MODEL PROMPT",
    );
  }
});

test("runtime start/restart and unknown availability labels localize without translating agent identity", () => {
  for (const [locale, expected] of [
    [
      "en",
      [
        "Start Agent",
        "Restart Agent",
        "Starting Agent",
        "Restarting Agent",
        "Availability unknown",
      ],
    ],
    [
      "ko",
      [
        "에이전트 시작",
        "에이전트 재시작",
        "에이전트 시작 중",
        "에이전트 재시작 중",
        "사용 가능 여부를 알 수 없습니다",
      ],
    ],
  ]) {
    setLocale(locale);
    const states = [
      { isRestartAction: false, isStarting: false, isRestarting: false },
      { isRestartAction: true, isStarting: false, isRestarting: false },
      { isRestartAction: false, isStarting: true, isRestarting: false },
      { isRestartAction: true, isStarting: true, isRestarting: true },
    ];
    states.forEach((bindings, index) => {
      assert.equal(
        initializer(
          `${agents}AgentRuntimeAvatarControl.tsx`,
          "actionLabel",
          bindings,
        ),
        expected[index],
      );
    });
    assert.equal(
      initializer(
        `${agents}AgentRuntimeAvatarControl.tsx`,
        "availabilityLabel",
        { availability: undefined },
      ),
      expected[4],
    );
    assert.equal(
      initializer(
        `${agents}AgentRuntimeAvatarControl.tsx`,
        "availabilityLabel",
        { availability: "available", getPresenceLabel: () => "PROVIDER LABEL" },
      ),
      "PROVIDER LABEL",
    );
  }
});

test("activity counts, names and fallback status are complete localized messages", () => {
  const path = `${channels}BotActivityBar.tsx`;
  for (const [locale, one, many, working] of [
    ["en", "USER 이름 is working", "2 agents working", "USER 이름: Working"],
    ["ko", "USER 이름 작업 중", "에이전트 2개 작업 중", "USER 이름: 작업 중"],
  ]) {
    setLocale(locale);
    const workingAgents = [{ name: "USER 이름", pubkey: "raw-key" }];
    assert.equal(initializer(path, "triggerLabel", { workingAgents }), one);
    assert.equal(
      initializer(path, "triggerLabel", {
        workingAgents: [...workingAgents, { name: "SECOND" }],
      }),
      many,
    );
    assert.equal(
      initializer(path, "visibleStatusLabel", {
        workingAgents,
        activityHeadlines: [],
        headlineIndex: 0,
      }),
      working,
    );
    assert.equal(
      initializer(path, "visibleStatusLabel", {
        workingAgents,
        activityHeadlines: ["USER TOOL OUTPUT"],
        headlineIndex: 0,
      }),
      "USER 이름: USER TOOL OUTPUT",
    );
    assert.equal(workingAgents[0].pubkey, "raw-key");
  }
});

test("last-updated title uses locale date formatting while preserving timestamp and local timezone", () => {
  const timestamp = new Date(2026, 0, 2, 15, 4, 5).getTime();
  for (const locale of ["en", "ko"]) {
    setLocale(locale);
    assert.equal(
      initializer(
        `${channels}AgentSessionThreadPanel.tsx`,
        "lastUpdatedTitle",
        { latestActivityAt: null },
      ),
      undefined,
    );
    const title = initializer(
      `${channels}AgentSessionThreadPanel.tsx`,
      "lastUpdatedTitle",
      { latestActivityAt: timestamp },
    );
    assert.equal(
      title,
      t("Last updated {value1}", {
        value1: formatLocalizedDateTime(
          new Intl.DateTimeFormat(localeTag(), {
            year: "numeric",
            month: "numeric",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            second: "2-digit",
          }),
          new Date(timestamp),
        ),
      }),
    );
  }
});

test("channel browser computed copy covers forum/channel, create/search and empty-state branches", () => {
  const path = `${channels}ChannelBrowserDialog.tsx`;
  const english = [
    "Search or create a channel",
    "Search channels by name or description",
    "Search or create a forum",
    "Search forums by name or description",
  ];
  const korean = [
    "채널 검색 또는 만들기",
    "이름이나 설명으로 채널 검색",
    "포럼 검색 또는 만들기",
    "이름이나 설명으로 포럼 검색",
  ];
  for (const locale of ["en", "ko"]) {
    setLocale(locale);
    let index = 0;
    for (const isForumMode of [false, true]) {
      const entityLabel = isForumMode ? "forum" : "channel";
      for (const canCreate of [true, false])
        assert.equal(
          initializer(path, "searchPlaceholder", { isForumMode, canCreate }),
          (locale === "en" ? english : korean)[index++],
        );
      assert.equal(
        initializer(path, "entityLabel", { isForumMode }),
        entityLabel,
        "canonical creation kind remains English",
      );
      for (const activeTab of ["all", "joined", "archived"])
        for (const deferredQuery of ["", "USER QUERY"]) {
          const bindings = {
            isForumMode,
            entityLabel,
            activeTab,
            deferredQuery,
            canCreate: true,
          };
          const title = initializer(path, "emptyTitle", bindings);
          const description = initializer(path, "emptyDescription", bindings);
          assert.match(
            title,
            locale === "ko" ? /채널|포럼/ : /channels|forums/,
          );
          assert.match(
            description,
            locale === "ko" ? /채널|포럼/ : /channel|forum/i,
          );
          if (locale === "ko")
            assert.doesNotMatch(
              `${title} ${description}`,
              /No |Archived |appear here|Create a new|to get started/,
            );
        }
    }
  }
});

test("real channel permissions DOM and selection retain canonical enum values", () => {
  let radioProps;
  const Permissions = component(
    `${channels}ChannelPermissionsSettings.tsx`,
    "ChannelPermissionsSettings",
    {
      cn,
      ChevronDown: icon,
      Globe: icon,
      Lock: icon,
      Button: ({ children, ...props }) =>
        React.createElement("button", { type: "button", ...props }, children),
      DropdownMenu: fragment,
      DropdownMenuContent: fragment,
      DropdownMenuTrigger: fragment,
      DropdownMenuRadioItem: fragment,
      DropdownMenuRadioGroup: (props) => {
        radioProps = props;
        return fragment(props);
      },
    },
  );
  for (const [locale, privateLabel, publicLabel] of [
    ["en", "Private", "Public"],
    ["ko", "비공개", "공개"],
  ]) {
    setLocale(locale);
    for (const [visibility, label] of [
      ["private", privateLabel],
      ["open", publicLabel],
    ]) {
      const selected = [];
      const document = render(Permissions, {
        visibility,
        testIdPrefix: "test",
        onVisibilityChange: (value) => selected.push(value),
      });
      assert.equal(
        document.querySelector("button").getAttribute("aria-label"),
        t("Visibility: {value1}", { value1: label }),
      );
      assert.equal(radioProps.value, visibility);
      radioProps.onValueChange("private");
      radioProps.onValueChange("open");
      assert.deepEqual(selected, ["private", "open"]);
    }
  }
});

test("channel description fallback changes language while authored content remains exact", () => {
  const Hero = component(
    `${channels}ChannelManagementSheetRows.tsx`,
    "ChannelHero",
    {
      Check: icon,
      ChevronRight: icon,
      Copy: icon,
      Info: icon,
      MessageSquare: icon,
      Pencil: icon,
      ChannelGlyph: icon,
    },
  );
  for (const [locale, fallback] of [
    ["en", "Add a description"],
    ["ko", "설명 추가"],
  ]) {
    setLocale(locale);
    for (const description of ["", "USER description", "Add a description"]) {
      const document = render(Hero, {
        channel: { channelType: "stream", name: "USER 이름", description },
        onEdit() {},
      });
      assert.equal(
        document.querySelector('[data-testid="channel-management-description"]')
          .textContent,
        description || fallback,
      );
      assert.equal(
        document.querySelector('[data-testid="channel-management-name-row"]')
          .textContent,
        "USER 이름",
      );
    }
  }
});

test("project computed defaults translate only app-owned labels and keep user names, branch and external errors", () => {
  for (const [locale, none, listed, unlisted, unknown, add, empty] of [
    [
      "en",
      "None",
      "Listed",
      "Unlisted",
      "Unknown author",
      "Add a repository to this project",
      "No files have been pushed yet.",
    ],
    [
      "ko",
      "없음",
      "목록에 표시",
      "목록에서 숨김",
      "알 수 없는 작성자",
      "이 프로젝트에 저장소 추가",
      "아직 푸시된 파일이 없습니다.",
    ],
  ]) {
    setLocale(locale);
    const settings = `${projects}CreateProjectFormSettings.tsx`;
    assert.equal(
      initializer(settings, "listingLabel", { projectVisibility: "listed" }),
      listed,
    );
    assert.equal(
      initializer(settings, "listingLabel", { projectVisibility: "unlisted" }),
      unlisted,
    );
    assert.equal(
      initializer(settings, "agentLabel", { selectedPersona: undefined }),
      none,
    );
    assert.equal(
      initializer(settings, "agentLabel", {
        selectedPersona: { displayName: "None" },
      }),
      "None",
    );
    assert.equal(
      initializer(
        `${projects}ProjectHomeContextPanel.tsx`,
        "addRepositoryTitle",
        { firstRepository: null },
      ),
      add,
    );
    assert.equal(
      initializer(
        `${projects}ProjectHomeContextPanel.tsx`,
        "addRepositoryTitle",
        { firstRepository: { name: "USER REPO" } },
      ),
      undefined,
    );
    const authorBindings = {
      matchedProfile: null,
      item: { commit: { authorName: "", authorEmail: "" } },
    };
    assert.equal(
      initializer(
        `${projects}ProjectDetailFeedPanels.tsx`,
        "authorLabel",
        authorBindings,
      ),
      unknown,
    );
    assert.equal(
      initializer(`${projects}ProjectDetailFeedPanels.tsx`, "authorLabel", {
        ...authorBindings,
        item: {
          commit: { authorName: "Unknown author", authorEmail: "USER EMAIL" },
        },
      }),
      "Unknown author",
    );
    assert.equal(
      initializer(`${projects}ProjectRepositoryPanel.tsx`, "stateMessage", {
        unavailableMessage: null,
        error: null,
        files: [],
      }),
      empty,
    );
    assert.equal(
      initializer(`${projects}ProjectRepositoryPanel.tsx`, "stateMessage", {
        unavailableMessage: "PROVIDER DIAGNOSTIC",
        error: null,
        files: [],
      }),
      "PROVIDER DIAGNOSTIC",
    );
    const workspaceSheetTab = "issues";
    assert.equal(
      initializer(`${projects}ProjectChannelHome.tsx`, "expandLabel", {
        workspaceSheetTab,
        projectHomeWorkspaceSheetTitle,
      }),
      locale === "en" ? "Open Tasks in repository" : "저장소에서 작업 열기",
    );
    assert.equal(workspaceSheetTab, "issues");
  }
});

test("review decisions preserve reviewer names and repo host labels preserve actual domain", () => {
  for (const [locale, expected, hosted] of [
    [
      "en",
      [
        "Approved by USER 이름",
        "Changes requested by USER 이름",
        "Re-review needed from USER 이름",
        "Awaiting review from USER 이름",
      ],
      "Git data hosted on git.USER.example",
    ],
    [
      "ko",
      [
        "USER 이름님이 승인함",
        "USER 이름님이 변경 요청함",
        "USER 이름님의 재리뷰 필요",
        "USER 이름님의 리뷰 대기 중",
      ],
      "git.USER.example에서 호스팅하는 Git 데이터",
    ],
  ]) {
    setLocale(locale);
    const states = [
      { hasApproved: true, hasRequestedChanges: false, needsRereview: false },
      { hasApproved: false, hasRequestedChanges: true, needsRereview: false },
      { hasApproved: false, hasRequestedChanges: false, needsRereview: true },
      { hasApproved: false, hasRequestedChanges: false, needsRereview: false },
    ];
    states.forEach((bindings, index) => {
      assert.equal(
        initializer(`${projects}PullRequestReviewersRow.tsx`, "decisionLabel", {
          ...bindings,
          label: "USER 이름",
        }),
        expected[index],
      );
    });
    assert.equal(
      initializer(`${projects}RepositoryCards.tsx`, "label", {
        host: { kind: "external", host: "git.USER.example" },
      }),
      hosted,
    );
  }
});

test("real aggregate error notice localizes full and partial failures while preserving server diagnostics and retry action", () => {
  const Notice = component(
    `${projects}ProjectsWorkItemsLoadNotice.tsx`,
    "ProjectsWorkItemsLoadNotice",
    {
      AlertCircle: icon,
      Button: ({ children, onClick, ...props }) =>
        React.createElement("button", { type: "button", ...props }, children),
    },
  );
  for (const locale of ["en", "ko"]) {
    setLocale(locale);
    for (const subject of ["issues", "pull requests", "project activity"]) {
      const failed = render(Notice, {
        error: new Error("USER SERVER DETAIL"),
        failedSections: [],
        subject,
        isRetrying: false,
        onRetry() {},
      });
      assert.match(
        failed.querySelector('[role="alert"]').textContent,
        /USER SERVER DETAIL/,
      );
      const partial = render(Notice, {
        error: null,
        failedSections: [
          "assignments",
          "comments",
          "pull-request-updates",
          "statuses",
        ],
        subject,
        isRetrying: true,
        onRetry() {},
      });
      if (locale === "ko") {
        assert.doesNotMatch(
          partial.querySelector('[role="alert"]').textContent,
          /Some |could not|Missing |assignments|comments|review updates|statuses|available results/,
        );
        assert.match(
          partial.querySelector('[role="alert"]').textContent,
          /담당자.*댓글.*리뷰 업데이트.*상태/,
        );
      }
      assert.equal(partial.querySelector("button").disabled, true);
      assert.equal(
        partial.querySelector("button").textContent,
        t("Retrying..."),
      );
    }
  }
});

test("actual effort and numeric fields translate descriptions while canonical values and env keys round trip", () => {
  const path = `${agents}buzzAgentModelTuningFields.tsx`;
  let selectProps;
  const bindings = {
    cn,
    numericTuningPlaceholder,
    BUZZ_AGENT_THINKING_EFFORT_VALUES: ["low", "medium", "high", "max"],
    Input: (props) => React.createElement("input", props),
    AgentDropdownSelect: (props) => {
      selectProps = props;
      return null;
    },
  };
  const Effort = component(path, "EffortSelectField", bindings);
  const Numeric = component(path, "NumericTuningFields", bindings);
  for (const locale of ["en", "ko"]) {
    setLocale(locale);
    const changed = [];
    render(Effort, {
      currentEffort: "high",
      effortValid: ["off", "low", "high", "PROVIDER_VALUE"],
      effortDefault: "high",
      htmlFor: "effort",
      label: "USER LABEL",
      useCustomSelect: true,
      onChange: (value) => changed.push(value),
    });
    assert.deepEqual(
      Array.from(selectProps.options, (option) => option.value),
      ["", "off", "low", "high", "PROVIDER_VALUE", "medium", "max"],
    );
    assert.equal(
      selectProps.options.find((option) => option.value === "high").label,
      locale === "en" ? "High (default)" : "높음(기본값)",
    );
    assert.equal(
      selectProps.options.find((option) => option.value === "PROVIDER_VALUE")
        .label,
      "PROVIDER_VALUE",
    );
    selectProps.onValueChange("high");
    assert.deepEqual(changed, ["high"]);
    const descriptors = ["maxOutputTokens", "contextLimit", "maxRounds"].map(
      (kind) => ({ kind, currentPersistence: { key: `USER_${kind}` } }),
    );
    const document = render(Numeric, {
      descriptors,
      envVars: { USER_maxRounds: "0" },
      inheritedEnvVars: {},
      onEnvVarChange() {},
    });
    assert.deepEqual(
      Array.from(document.querySelectorAll("input"), (input) => input.min),
      ["1", "1", "0"],
    );
    assert.equal(
      document.querySelector('[data-testid="numeric-max-rounds-input"]').value,
      "0",
    );
    if (locale === "ko")
      assert.doesNotMatch(
        document.body.textContent,
        /Max output tokens|Context limit|Max rounds|Maximum |Leave blank to inherit/,
      );
    else
      assert.match(
        document.body.textContent,
        /Maximum LLM \+ tool-call rounds per turn/,
      );
  }
});

test("actual normalized field rows localize static labels without changing runtime config values", () => {
  const Config = component(
    `${agents}AgentConfigPanel.tsx`,
    "AgentConfigSurfaceRows",
    {
      Activity: icon,
      Brain: icon,
      Cpu: icon,
      Hash: icon,
      Layers: icon,
      MessageSquare: icon,
      Server: icon,
      cn,
      shouldRenderMcpServers: () => false,
      PanelSectionGroup: ({ title, children }) =>
        React.createElement(
          "section",
          null,
          React.createElement("h2", null, title),
          children,
        ),
    },
  );
  const data = {
    normalized: {
      thinkingEffort: { value: "RAW_RUNTIME_HIGH", origin: "env" },
      systemPrompt: { value: "USER PROMPT", origin: "configFile" },
    },
    advanced: [],
    extensions: [],
    runtimeId: "USER_RUNTIME",
    sources: {},
  };
  for (const locale of ["en", "ko"]) {
    setLocale(locale);
    const document = render(Config, {
      data,
      advancedMode: "flat",
      sections: ["model"],
    });
    assert.match(
      document.body.textContent,
      locale === "ko" ? /추론 수준/ : /Thinking effort/,
    );
    assert.match(
      document.body.textContent,
      locale === "ko" ? /시스템 프롬프트/ : /System prompt/,
    );
    assert.match(document.body.textContent, /RAW_RUNTIME_HIGH/);
    assert.match(document.body.textContent, /USER PROMPT/);
    assert.equal(data.normalized.thinkingEffort.value, "RAW_RUNTIME_HIGH");
  }
});

test("actual dropdown defaults translate while provided prompts and model option labels remain untouched", () => {
  const Dropdown = component(
    `${agents}agentConfigControls.tsx`,
    "AgentDropdownSelect",
    {
      cn,
      ChevronDown: icon,
      Check: icon,
      Search: icon,
      Popover: fragment,
      PopoverTrigger: fragment,
      PopoverContent: fragment,
    },
  );
  for (const [locale, prompt, empty] of [
    ["en", "Select", "No options available"],
    ["ko", "선택", "사용 가능한 옵션이 없습니다"],
  ]) {
    setLocale(locale);
    const document = render(Dropdown, {
      id: "models",
      options: [],
      value: "",
      onValueChange() {},
    });
    assert.equal(
      document.querySelector('[role="combobox"]').textContent,
      prompt,
    );
    assert.match(document.body.textContent, new RegExp(empty));
    const provided = render(Dropdown, {
      id: "models",
      options: [{ label: "USER MODEL", value: "raw-model" }],
      value: "raw-model",
      placeholder: "Select",
      emptyOptionsLabel: "No options available",
      onValueChange() {},
    });
    assert.equal(
      provided.querySelector('[role="combobox"]').textContent,
      "USER MODEL",
    );
    assert.equal(
      provided.querySelector('[role="option"]').getAttribute("data-value"),
      "raw-model",
    );
    const noSelection = render(Dropdown, {
      id: "models",
      options: [],
      value: "",
      placeholder: "Select",
      emptyOptionsLabel: "No options available",
      onValueChange() {},
    });
    assert.equal(
      noSelection.querySelector('[role="combobox"]').textContent,
      "Select",
    );
    assert.match(noSelection.body.textContent, /No options available/);
    assert.equal(
      initializer(`${agents}agentConfigControls.tsx`, "restingPlaceholder", {
        modelDiscoveryLoading: false,
        discoveredModelOptions: [],
        trimmedModel: "",
        isCustomModelEditing: false,
        placeholder: undefined,
      }),
      locale === "ko" ? "모델 선택" : "Select model",
    );
  }
});

test("session scope and mode fallbacks translate but canonical channel names stay exact", () => {
  for (const locale of ["en", "ko"]) {
    setLocale(locale);
    const path = `${channels}AgentSessionThreadPanel.tsx`;
    assert.equal(
      initializer(path, "scopeLabel", {
        sessionChannelId: null,
        scopeChannelName: null,
      }),
      locale === "ko" ? "모든 채널" : "All channels",
    );
    assert.equal(
      initializer(path, "scopeLabel", {
        sessionChannelId: "raw-channel",
        scopeChannelName: null,
      }),
      locale === "ko" ? "채널 1개" : "1 channel",
    );
    assert.equal(
      initializer(path, "scopeLabel", {
        sessionChannelId: "raw-channel",
        scopeChannelName: "All channels",
      }),
      "#All channels",
    );
    assert.equal(
      initializer(path, "viewLabel", { showRawFeed: true }),
      locale === "ko" ? "ACP 활동 원본" : "Raw ACP activity",
    );
  }
});

test("real imported modules update constant-map labels EN→KO→EN with stable parent props and preserve live HTML selection", async () => {
  const dom = new JSDOM(
    "<!doctype html><html><body><div id='host'></div></body></html>",
    { url: "https://buzz.test" },
  );
  const previous = new Map();
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    });
  }
  const { createRoot } = await import("react-dom/client");
  const host = document.getElementById("host");
  const root = createRoot(host);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  queryClient.setQueryData(projectsQueryKey, []);
  const changes = [];
  const descriptors = [
    { kind: "maxRounds", currentPersistence: { key: "RAW_MAX_ROUNDS" } },
  ];
  const envVars = { RAW_MAX_ROUNDS: "0" };
  const channel = {
    channelType: "stream",
    name: "USER CHANNEL",
    description: "",
  };
  const data = {
    normalized: { thinkingEffort: { value: "RAW_HIGH", origin: "env" } },
    advanced: [],
    extensions: [],
    runtimeId: "USER_RUNTIME",
    sources: {},
  };
  let formRenders = 0;
  function Form() {
    formRenders += 1;
    const [value, setValue] = React.useState("low");
    return React.createElement(
      React.Fragment,
      null,
      React.createElement(ActualEffort, {
        currentEffort: value,
        effortValid: ["low", "high"],
        effortDefault: "high",
        htmlFor: "mounted-effort",
        label: "USER MODEL",
        onChange(next) {
          changes.push(next);
          setValue(next);
        },
      }),
      React.createElement(ActualNumeric, {
        descriptors,
        envVars,
        inheritedEnvVars: {},
        onEnvVarChange() {},
      }),
      React.createElement(ActualConfigRows, {
        data,
        advancedMode: "flat",
        sections: ["model"],
      }),
      React.createElement(ActualChannelHero, { channel, onEdit() {} }),
      React.createElement(ActualNotice, {
        error: new Error("PROVIDER DETAIL"),
        failedSections: [],
        subject: "issues",
        isRetrying: false,
        onRetry() {},
      }),
    );
  }
  try {
    setLocale("en");
    await React.act(async () =>
      root.render(
        React.createElement(
          QueryClientProvider,
          { client: queryClient },
          React.createElement(React.memo(Form)),
        ),
      ),
    );
    const select = host.querySelector("select");
    assert.equal(select.value, "low");
    await React.act(async () => {
      select.value = "high";
      select.dispatchEvent(new window.Event("change", { bubbles: true }));
    });
    assert.deepEqual(changes, ["high"]);
    assert.equal(select.selectedOptions[0].textContent, "High (default)");
    assert.match(host.textContent, /Max rounds/);
    assert.match(host.textContent, /Thinking effort/);
    assert.match(host.textContent, /Add a description/);
    const rendersBeforeLocale = formRenders;
    await React.act(async () => setLocale("ko"));
    assert.equal(
      formRenders,
      rendersBeforeLocale,
      "same parent render and child props through locale switching",
    );
    assert.equal(
      host.querySelector("select"),
      select,
      "no replacement/reset of the live control",
    );
    assert.equal(select.value, "high");
    assert.equal(select.selectedOptions[0].textContent, "높음(기본값)");
    assert.equal(host.querySelector("label").textContent, "USER MODEL");
    assert.match(host.textContent, /최대 반복 횟수/);
    assert.match(host.textContent, /추론 수준/);
    assert.match(host.textContent, /설명 추가/);
    assert.doesNotMatch(
      host.textContent,
      /Max rounds|Thinking effort|Add a description|Could not load/,
    );
    assert.match(host.textContent, /PROVIDER DETAIL/);
    assert.match(host.textContent, /RAW_HIGH/);
    assert.match(host.textContent, /USER CHANNEL/);
    assert.equal(
      host.querySelector('[data-testid="numeric-max-rounds-input"]').value,
      "0",
    );
    assert.deepEqual(
      changes,
      ["high"],
      "a language switch does not write the option value",
    );
    await React.act(async () => setLocale("en"));
    assert.equal(select.value, "high");
    assert.equal(select.selectedOptions[0].textContent, "High (default)");
    assert.equal(formRenders, rendersBeforeLocale);
    assert.match(host.textContent, /Max rounds/);
    assert.match(host.textContent, /Thinking effort/);
    assert.match(host.textContent, /Add a description/);
  } finally {
    await React.act(async () => root.unmount());
    queryClient.clear();
    setLocale("en");
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
