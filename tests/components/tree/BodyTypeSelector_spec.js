import { expect } from 'chai';
import { BodyTypeSelector } from '../../../sources/components/tree/BodyTypeSelector.js';
import { state } from '../../../sources/state/state.js';

describe('BodyTypeSelector Component', () => {
  let vnode;

  beforeEach(() => {
    vnode = { state: {} };
    BodyTypeSelector.oninit(vnode);
  });

  it('should initialize with isExpanded set to true', () => {
    expect(vnode.state.isExpanded).to.be.true;
  });

  it('should toggle isExpanded state when tree label is clicked', () => {
    const treeLabel = BodyTypeSelector.view(vnode).children[0];
    treeLabel.attrs.onclick();
    expect(vnode.state.isExpanded).to.be.false;

    treeLabel.attrs.onclick();
    expect(vnode.state.isExpanded).to.be.true;
  });

  it('should render body type buttons when expanded', () => {
    vnode.state.isExpanded = true;
    const view = BodyTypeSelector.view(vnode);
    const buttonsContainer = view.children[1].children[0];

    expect(buttonsContainer.children).to.have.lengthOf(6); // 6 body types
    const buttonLabels = buttonsContainer.children.map(button => button.children[0].children);

    expect(buttonLabels).to.deep.equal(['Male', 'Female', 'Teen', 'Child', 'Muscular', 'Pregnant']);
  });

  it('should not render body type buttons when collapsed', () => {
    vnode.state.isExpanded = false;
    const view = BodyTypeSelector.view(vnode);

    expect(view.children[1]).to.be.null;
  });

  it('should update state.bodyType when a button is clicked', () => {
    vnode.state.isExpanded = true;
    const view = BodyTypeSelector.view(vnode);
    const buttonsContainer = view.children[1].children[0];

    const maleButton = buttonsContainer.children[0];
    maleButton.attrs.onclick();
    expect(state.bodyType).to.equal('male');

    const femaleButton = buttonsContainer.children[1];
    femaleButton.attrs.onclick();
    expect(state.bodyType).to.equal('female');
  });

  it('should apply "is-primary" class to the selected body type button', () => {
    state.bodyType = 'male';
    vnode.state.isExpanded = true;
    const view = BodyTypeSelector.view(vnode);
    const buttonsContainer = view.children[1].children[0];

    const maleButton = buttonsContainer.children[0];
    const femaleButton = buttonsContainer.children[1];

    expect(maleButton.attrs.className).to.include('is-primary');
    expect(femaleButton.attrs.className).to.not.include('is-primary');
  });
});
