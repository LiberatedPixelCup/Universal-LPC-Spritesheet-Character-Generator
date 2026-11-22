// Advanced Tools component - Custom file upload with z-position
import m from "mithril";
import { clearCustomImage, type State } from "../../state/state.ts";
import { CollapsibleSection } from "../CollapsibleSection.ts";

const CUSTOM_ZPOS_INPUT_ID = "customImageZPosInput";

export const AdvancedTools: m.Component<
  { state: State },
  { fileRequest?: number }
> = {
  view(vnode) {
    const { state } = vnode.attrs;
    const handleFileUpload = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      const request = ++state.customImageRequest;
      vnode.state.fileRequest = request;
      const img = new Image();
      img.onload = () => {
        if (request !== state.customImageRequest) return;
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

    return m(
      CollapsibleSection,
      {
        title: "Advanced Tools",
        defaultOpen: false,
        boxClass: "box lpc-advanced-panel",
      },
      m("div.lpc-advanced-form", [
        m("div.field.lpc-advanced-field", [
          m("label.label", { for: "customFileInput" }, "Custom File Upload"),
          m("div.control", [
            m("input.input[type=file]#customFileInput", {
              accept: "image/*",
              onchange: handleFileUpload,
              onupdate: (inputVnode) => {
                if (vnode.state.fileRequest !== state.customImageRequest) {
                  (inputVnode.dom as HTMLInputElement).value = "";
                }
              },
            }),
          ]),
          m(
            "p.help",
            "Upload a local image file to overlay on the spritesheet",
          ),
        ]),
        m("div.field.lpc-advanced-field", [
          m("label.label", { for: CUSTOM_ZPOS_INPUT_ID }, "Z-Position"),
          m("div.control", [
            m("input.input[type=number]", {
              id: CUSTOM_ZPOS_INPUT_ID,
              value: state.customImageZPos,
              oninput: handleZPosChange,
              placeholder: "0",
            }),
          ]),
          m("p.help", [
            "Layer order: ",
            m("code", "0=shadow"),
            ", ",
            m("code", "10=body"),
            ", ",
            m("code", "70=arms"),
            ", ",
            m("code", "110=beard"),
          ]),
        ]),
        state.customUploadedImage &&
          m("div.field.lpc-advanced-field", [
            m("div.control", [
              m(
                "button.button.is-small.is-warning.lpc-btn-warning",
                {
                  type: "button",
                  onclick: () => clearCustomImage(state),
                },
                "Clear Custom Image",
              ),
            ]),
          ]),
      ]),
    );
  },
};
