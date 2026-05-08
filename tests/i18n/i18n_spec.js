import { expect } from "chai";
import { afterEach, describe, it } from "mocha-globals";
import {
  DEFAULT_LOCALE,
  getLocale,
  normalizeLocale,
  setLocale,
  t,
} from "../../sources/i18n/index.ts";
import {
  translateCategoryLabel,
  translateSelectionName,
} from "../../sources/i18n/metadata.ts";

describe("i18n", () => {
  afterEach(() => {
    setLocale(DEFAULT_LOCALE);
  });

  it("returns English messages by default", () => {
    setLocale("en");
    expect(t("download.title")).to.equal("Download");
  });

  it("returns Chinese and Japanese messages", () => {
    setLocale("zh-CN");
    expect(t("download.title")).to.equal("下载");

    setLocale("ja");
    expect(t("download.title")).to.equal("ダウンロード");
  });

  it("interpolates params", () => {
    setLocale("en");
    expect(t("filters.removedIncompatible", { count: 3 })).to.equal(
      "Removed 3 incompatible item(s)",
    );
  });

  it("normalizes browser locale values", () => {
    expect(normalizeLocale("zh-Hans-CN")).to.equal("zh-CN");
    expect(normalizeLocale("ja-JP")).to.equal("ja");
    expect(normalizeLocale("en-US")).to.equal("en");
    expect(normalizeLocale("fr-FR")).to.equal(null);
  });

  it("tracks the active locale", () => {
    setLocale("ja");
    expect(getLocale()).to.equal("ja");
  });

  it("translates metadata labels with fallback", () => {
    setLocale("zh-CN");
    expect(translateCategoryLabel("Body", "Body")).to.equal("身体");
    expect(translateCategoryLabel("head_coverings", "Head Coverings")).to.equal(
      "头部覆盖物",
    );
    expect(
      translateCategoryLabel("hat_helmet_mail", "hat_helmet_mail"),
    ).to.equal("帽子头盔锁子甲");
    expect(
      translateSelectionName(
        {
          itemId: "body",
          variant: "",
          recolor: "light",
          name: "Body Color (light)",
        },
        { name: "Body Color" },
      ),
    ).to.equal("身体颜色（浅色）");

    setLocale("en");
    expect(translateCategoryLabel("Body", "Body")).to.equal("Body");
  });
});
