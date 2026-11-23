import m from "mithril";
import { clearCustomImage, type State } from "../../state/state.ts";

export type AdvancedToolsDrawerAttrs = {
  state: State;
  onClose: () => void;
};

const CUSTOM_ZPOS_INPUT_ID = "customImageZPosDrawerInput";

export const AdvancedToolsDrawer: m.Component<
  AdvancedToolsDrawerAttrs,
  { fileRequest?: number; uploadError?: string | null }
> = {
  view(vnode) {
    const { state, onClose } = vnode.attrs;

    const handleFileUpload = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      const request = ++state.customImageRequest;
      vnode.state.fileRequest = request;
      vnode.state.uploadError = null;
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        if (request !== state.customImageRequest) return;
        if (state.isExportingZip) {
          state.pendingCustomImageResult = {
            requestId: request,
            image: img,
            zPos: state.customImageZPos,
          };
          return;
        }
        state.customUploadedImage = img;
        m.redraw();
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        if (request !== state.customImageRequest) return;
        vnode.state.uploadError = "Failed to load selected image file.";
        target.value = "";
        m.redraw();
      };
      img.src = objectUrl;
    };

    const handleZPosChange = (e: Event) => {
      if (state.isExportingZip) return;
      const target = e.target as HTMLInputElement;
      const value = parseInt(target.value, 10);
      state.customImageZPos = isNaN(value) ? 0 : value;
      m.redraw();
    };

    return m(
      "aside.lpc-drawer.lpc-advanced-drawer",
      {
        role: "dialog",
        "aria-modal": "false",
        "aria-label": "Advanced Tools",
      },
      [
        m("div.lpc-drawer-header", [
          m("h3.lpc-drawer-title", "Advanced Tools"),
          m("button.delete", {
            type: "button",
            "aria-label": "Close Advanced Tools",
            onclick: onClose,
          }),
        ]),
        m("div.lpc-drawer-body", [
          m("div.field.lpc-advanced-field", [
            m(
              "label.label",
              { for: "customFileDrawerInput" },
              "Custom File Upload",
            ),
            m("div.control", [
              m("input.input[type=file]#customFileDrawerInput", {
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
            vnode.state.uploadError &&
              m("p.help.is-danger", vnode.state.uploadError),
          ]),
          m("div.field.lpc-advanced-field", [
            m("label.label", { for: CUSTOM_ZPOS_INPUT_ID }, "Z-Position"),
            m("div.control", [
              m("input.input[type=number]", {
                id: CUSTOM_ZPOS_INPUT_ID,
                value: state.customImageZPos,
                disabled: state.isExportingZip,
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
                    disabled: state.isExportingZip,
                    onclick: () => {
                      if (state.isExportingZip) return;
                      vnode.state.uploadError = null;
                      clearCustomImage(state);
                    },
                  },
                  "Clear Custom Image",
                ),
              ]),
            ]),
        ]),
      ],
    );
  },
};
