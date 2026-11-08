import test from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { LocalizedMessage } from "./LocalizedMessage.tsx";
import { setLocale } from "./index.ts";
test("rich sentences reorder live React nodes without translating user data or losing handlers", async () => {
  setLocale("ko");
  let clicked = 0;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      React.createElement(LocalizedMessage, {
        message:
          "Merge {branch} into {target} and push the result to the repository. The remote will reject the operation if the branch changed or conflicts.",
        values: {
          branch: React.createElement(
            "button",
            { type: "button", onClick: () => clicked++ },
            "문서",
          ),
          target: "Alice",
        },
      }),
    ),
  );
  assert.equal(
    container.textContent,
    "문서 브랜치를 Alice 브랜치에 병합하고 결과를 저장소에 푸시합니다. 브랜치가 변경되었거나 충돌이 있으면 원격 저장소에서 작업을 거부합니다.",
  );
  await act(async () => container.querySelector("button").click());
  assert.equal(clicked, 1);
  await act(async () => setLocale("en"));
  assert.equal(
    container.textContent,
    "Merge 문서 into Alice and push the result to the repository. The remote will reject the operation if the branch changed or conflicts.",
  );
  await act(async () => root.unmount());
  container.remove();
  setLocale("en");
});
