// Advanced Tools component - Custom file upload with z-position
import m from "mithril";
import { state } from "../../state/state.ts";
import { CollapsibleSection } from "../CollapsibleSection.ts";
import { t } from "../../../lang/i18n.ts";

export const AdvancedTools: m.Component = {
  view() {
    const handleFileUpload = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      const img = new Image();
      img.onload = () => {
        state.customUploadedImage = img;
        m.redraw();
      };
      img.src = URL.createObjectURL(file);
    };

    const handleZPosChange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const value = parseInt(target.value, 10);
      state.customImageZPos = isNaN(value) ? 0 : value;
      m.redraw();
    };

    const clearCustomImage = () => {
      state.customUploadedImage = null;
      state.customImageZPos = 0;
      const fileInput = document.getElementById(
        "customFileInput",
      ) as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";
      m.redraw();
    };

    return m(
      CollapsibleSection,
      {
        title: t("advancedTools.title"),
        defaultOpen: false,
      },
      [
        m("div.field", [
          m("label.label", t("advancedTools.customFileUpload")),
          m("div.control", [
            m("input.input[type=file]#customFileInput", {
              accept: "image/*",
              onchange: handleFileUpload,
            }),
          ]),
          m("p.help", t("advancedTools.uploadHelp")),
        ]),
        m("div.field", [
          m("label.label", t("advancedTools.zPosition")),
          m("div.control", [
            m("input.input[type=number]", {
              value: state.customImageZPos,
              oninput: handleZPosChange,
              placeholder: "0",
            }),
          ]),
          m("p.help", [
            t("advancedTools.layerOrder"),
            m("code", t("advancedTools.layer0")),
            ", ",
            m("code", t("advancedTools.layer10")),
            ", ",
            m("code", t("advancedTools.layer70")),
            ", ",
            m("code", t("advancedTools.layer110")),
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
                t("advancedTools.clearCustomImage"),
              ),
            ]),
          ]),
      ],
    );
  },
};
