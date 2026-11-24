import m from "mithril";

type DownloadDialogAttrs = {
  titleId: string;
  onClose: () => void;
  renderCard: (close: () => void) => m.Children;
};

type DownloadDialogState = {
  closing?: boolean;
  dialog?: HTMLDialogElement;
};

function showDownloadDialog(
  vnode: m.VnodeDOM<DownloadDialogAttrs, DownloadDialogState>,
): void {
  const dialog = vnode.dom as HTMLDialogElement;
  if (
    vnode.state.closing ||
    dialog.open ||
    dialog.ownerDocument.querySelector("dialog.palette-modal[open]")
  ) {
    return;
  }
  dialog.showModal();
  dialog.querySelector<HTMLButtonElement>(".modal-card-head .delete")?.focus();
}

export const DownloadDialog: m.Component<
  DownloadDialogAttrs,
  DownloadDialogState
> = {
  oncreate(vnode) {
    vnode.state.dialog = vnode.dom as HTMLDialogElement;
    showDownloadDialog(vnode);
  },
  onupdate: showDownloadDialog,
  onremove(vnode) {
    vnode.state.closing = true;
    const dialog = vnode.dom as HTMLDialogElement;
    if (dialog.open) dialog.close();
  },
  view(vnode) {
    const close = () => {
      if (vnode.state.closing) return;
      vnode.state.closing = true;
      const dialog = vnode.state.dialog;
      if (dialog?.open) dialog.close();
      vnode.attrs.onClose();
    };
    return m(
      "dialog.modal.lpc-modal",
      {
        "aria-labelledby": vnode.attrs.titleId,
        oncancel: (event: Event) => {
          event.preventDefault();
          close();
        },
        onclose: close,
      },
      [
        m("div.modal-background", { onclick: close }),
        vnode.attrs.renderCard(close),
      ],
    );
  },
};
