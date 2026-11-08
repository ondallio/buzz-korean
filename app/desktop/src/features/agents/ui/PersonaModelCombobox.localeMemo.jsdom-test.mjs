import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { fireEvent } from "@testing-library/react";
import { setLocale, useLocale, t } from "@/shared/i18n";
import { PersonaModelCombobox } from "./PersonaModelCombobox.tsx";
import { modelDropdownOptions } from "./relayMeshModelPicker.ts";
for (const upstream of [false, true]) {
  test(`language change retains searched keyboard selection with ${upstream ? "actual fresh dropdown producer" : "stable raw options"}`, async () => {
    setLocale("en");
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const selected = [];
    const options = [
      { value: "model-first", label: "model first" },
      { value: "model-second", label: "model second" },
    ];
    try {
      function ActualProducerHost() {
        useLocale();
        return React.createElement(PersonaModelCombobox, {
          id: "model-picker",
          value: "",
          placeholder: "USER PLACEHOLDER",
          onValueChange: (value) => selected.push(value),
          options: upstream
            ? modelDropdownOptions({
                options: options.map(({ value, label }) => ({
                  id: value,
                  label,
                })),
                loading: false,
                loadingValue: "LOADING_ID",
                allowCustom: true,
              })
            : options,
        });
      }
      await act(async () =>
        root.render(React.createElement(ActualProducerHost)),
      );
      await act(async () =>
        fireEvent.click(document.getElementById("model-picker")),
      );
      const search = document.querySelector(
        'input[aria-label="Search models"]',
      );
      await act(async () =>
        fireEvent.change(search, { target: { value: "model" } }),
      );
      await act(async () => fireEvent.keyDown(search, { key: "ArrowDown" }));
      await act(async () => setLocale("ko"));
      assert.ok(
        document.querySelector('input[aria-label="모델 검색"]') === search,
      );
      assert.equal(search.value, "model");
      if (upstream)
        assert.ok(document.body.textContent.includes(t("Custom model...")));
      await act(async () => fireEvent.keyDown(search, { key: "Enter" }));
      assert.deepEqual(selected, ["model-second"]);
      assert.deepEqual(
        options.map((option) => option.value),
        ["model-first", "model-second"],
      );
    } finally {
      await act(async () => root.unmount());
      host.remove();
      setLocale("en");
    }
  });
}

for (const change of ["query", "disabled catalog entry"]) {
  test(`${change} still resets highlight to an enabled matching model`, async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const selected = [];
    let options = [
      { value: "model-first", label: "model first" },
      { value: "model-second", label: "model second" },
    ];
    const render = () =>
      root.render(
        React.createElement(PersonaModelCombobox, {
          id: "reset-picker",
          options,
          value: "",
          placeholder: "USER MODEL",
          onValueChange: (value) => selected.push(value),
        }),
      );
    try {
      await act(async () => render());
      await act(async () =>
        fireEvent.click(document.getElementById("reset-picker")),
      );
      const search = document.querySelector(
        'input[aria-label="Search models"]',
      );
      await act(async () =>
        fireEvent.change(search, { target: { value: "model" } }),
      );
      await act(async () => fireEvent.keyDown(search, { key: "ArrowDown" }));
      if (change === "query") {
        await act(async () =>
          fireEvent.change(search, { target: { value: "first" } }),
        );
      } else {
        options = options.map((option) => ({
          ...option,
          disabled: option.value === "model-second",
        }));
        await act(async () => render());
      }
      await act(async () => fireEvent.keyDown(search, { key: "Enter" }));
      assert.deepEqual(selected, ["model-first"]);
    } finally {
      await act(async () => root.unmount());
      host.remove();
      setLocale("en");
    }
  });
}
