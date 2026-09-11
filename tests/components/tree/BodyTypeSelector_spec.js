import { expect } from "chai";
import { describe, it, beforeEach } from "mocha-globals";
import { BodyTypeSelector } from "../../../sources/components/tree/BodyTypeSelector.ts";

describe("BodyTypeSelector Component", () => {
  let vnode;
  let selected;

  beforeEach(() => {
    selected = undefined;
    const model = {
      selected: "female",
      options: [
        { value: "male", label: "Male" },
        { value: "female", label: "Female" },
      ],
      select(value) {
        selected = value;
      },
    };
    vnode = { state: {}, attrs: { model } };
    BodyTypeSelector.oninit(vnode);
  });

  it("should initialize with isExpanded set to true", () => {
    expect(vnode.state.isExpanded).to.be.true;
  });

  it("should toggle isExpanded state when tree label is clicked", () => {
    const treeLabel = BodyTypeSelector.view(vnode).children[0];
    treeLabel.attrs.onclick();
    expect(vnode.state.isExpanded).to.be.false;

    treeLabel.attrs.onclick();
    expect(vnode.state.isExpanded).to.be.true;
  });

  it("should render body type buttons when expanded", () => {
    vnode.state.isExpanded = true;
    const view = BodyTypeSelector.view(vnode);
    const buttonsContainer = view.children[1].children[0];

    expect(buttonsContainer.children).to.have.lengthOf(2);
    const buttonLabels = buttonsContainer.children.map(
      (button) => button.children[0].children,
    );

    expect(buttonLabels).to.deep.equal(["Male", "Female"]);
  });

  it("should not render body type buttons when collapsed", () => {
    vnode.state.isExpanded = false;
    const view = BodyTypeSelector.view(vnode);

    expect(view.children[1]).to.be.null;
  });

  it("should pass the selected value to the model", () => {
    vnode.state.isExpanded = true;
    const view = BodyTypeSelector.view(vnode);
    const buttonsContainer = view.children[1].children[0];

    const maleButton = buttonsContainer.children[0];
    maleButton.attrs.onclick();
    expect(selected).to.equal("male");

    const femaleButton = buttonsContainer.children[1];
    femaleButton.attrs.onclick();
    expect(selected).to.equal("female");
  });

  it('should apply "is-primary" class to the selected body type button', () => {
    const view = BodyTypeSelector.view(vnode);
    const buttonsContainer = view.children[1].children[0];

    const maleButton = buttonsContainer.children[0];
    const femaleButton = buttonsContainer.children[1];

    expect(maleButton.attrs.className).to.not.include("is-primary");
    expect(femaleButton.attrs.className).to.include("is-primary");
  });
});
