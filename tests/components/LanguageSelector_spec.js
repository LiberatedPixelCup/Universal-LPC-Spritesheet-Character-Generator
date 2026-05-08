import { assert } from "chai";
import { afterEach, beforeEach, describe, it } from "mocha-globals";
import { LanguageSelector } from "../../sources/components/LanguageSelector.js";
import {
  resetStateDeps,
  setStateDeps,
  state,
} from "../../sources/state/state.ts";
import { DEFAULT_LOCALE, setLocale } from "../../sources/i18n/index.ts";

describe("LanguageSelector", function () {
  let container;

  beforeEach(function () {
    state.locale = DEFAULT_LOCALE;
    setLocale(DEFAULT_LOCALE);
    setStateDeps({
      syncSelectionsToHash: () => {},
      redraw: () => {},
    });
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(function () {
    resetStateDeps();
    state.locale = DEFAULT_LOCALE;
    setLocale(DEFAULT_LOCALE);
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  it("renders all supported language options", function () {
    m.render(container, m(LanguageSelector));

    const options = Array.from(container.querySelectorAll("option"));
    assert.deepEqual(
      options.map((option) => option.value),
      ["en", "zh-CN", "ja"],
    );
    assert.deepEqual(
      options.map((option) => option.textContent),
      ["English", "简体中文", "日本語"],
    );
  });

  it("updates locale when the selected language changes", function () {
    m.render(container, m(LanguageSelector));

    const select = container.querySelector("select");
    select.value = "ja";
    select.dispatchEvent(new Event("change", { bubbles: true }));

    assert.strictEqual(state.locale, "ja");
    assert.strictEqual(document.documentElement.lang, "ja");
  });
});
