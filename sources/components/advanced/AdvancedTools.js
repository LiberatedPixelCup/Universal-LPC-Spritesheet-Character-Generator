// Advanced Tools component - Custom file upload with z-position
import m from "mithril";
import { state } from "../../state/state.ts";
import { CollapsibleSection } from "../CollapsibleSection.js";
import { t } from "../../i18n/index.ts";

export const AdvancedTools = {
  view: function () {
    const handleFileUpload = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // Load the image file
      const img = new Image();
      img.onload = function () {
        state.customUploadedImage = img;
        m.redraw();
      };
      img.src = URL.createObjectURL(file);
    };

    const handleZPosChange = (e) => {
      const value = parseInt(e.target.value);
      state.customImageZPos = isNaN(value) ? 0 : value;
      m.redraw();
    };

    const clearCustomImage = () => {
      state.customUploadedImage = null;
      state.customImageZPos = 0;
      // Clear the file input
      const fileInput = document.getElementById("customFileInput");
      if (fileInput) fileInput.value = "";
      m.redraw();
    };

    return m(
      CollapsibleSection,
      {
        title: t("advanced.title"),
        storageKey: "advanced",
        defaultOpen: false,
      },
      [
        m("div.field", [
          m("label.label", t("advanced.customFileUpload")),
          m("div.control", [
            m("input.input[type=file]#customFileInput", {
              accept: "image/*",
              onchange: handleFileUpload,
            }),
          ]),
          m("p.help", t("advanced.customFileHelp")),
        ]),
        m("div.field", [
          m("label.label", t("advanced.zPosition")),
          m("div.control", [
            m("input.input[type=number]", {
              value: state.customImageZPos,
              oninput: handleZPosChange,
              placeholder: "0",
            }),
          ]),
          m("p.help", [
            t("advanced.layerOrder"),
            m("code", `0=${t("metadata.word.shadow")}`),
            ", ",
            m("code", `10=${t("metadata.word.body")}`),
            ", ",
            m("code", `70=${t("metadata.word.arms")}`),
            ", ",
            m("code", `110=${t("metadata.word.beard")}`),
          ]),
        ]),
        state.customUploadedImage &&
          m("div.field", [
            m("div.control", [
              m(
                "button.button.is-small.is-warning",
                {
                  onclick: clearCustomImage,
                },
                t("advanced.clearCustomImage"),
              ),
            ]),
          ]),
      ],
    );
  },
};
