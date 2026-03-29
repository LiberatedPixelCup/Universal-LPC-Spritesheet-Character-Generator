import { FiltersPanel } from '../../sources/components/FiltersPanel.js';
import { CollapsibleSection } from '../../sources/components/CollapsibleSection.js';
import { SearchControl } from '../../sources/components/filters/SearchControl.js';
import { LicenseFilters } from '../../sources/components/filters/LicenseFilters.js';
import { AnimationFilters } from '../../sources/components/filters/AnimationFilters.js';
import { CurrentSelections } from '../../sources/components/selections/CurrentSelections.js';
import { CategoryTree } from '../../sources/components/tree/CategoryTree.js';
import { expect } from 'chai';

describe('FiltersPanel', () => {
  let vnode;

  beforeEach(() => {
    vnode = FiltersPanel.view();
  });

  it('should render the CollapsibleSection component with correct attributes', () => {
    expect(vnode.tag).to.equal(CollapsibleSection);
    expect(vnode.attrs).to.deep.include({
      title: "Filters",
      storageKey: "filters",
      defaultOpen: true
    });
  });

  it('should render the SearchControl component', () => {
    const searchControl = vnode.children[0].children[0];
    expect(searchControl.tag).to.equal(SearchControl);
  });

  it('should render LicenseFilters and AnimationFilters in a responsive wrapper', () => {
    const columns = vnode.children[1].children;
    expect(columns).to.have.lengthOf(2);

    const licenseFilters = columns[0].children[0];
    const animationFilters = columns[1].children[0];

    expect(licenseFilters.tag).to.equal(LicenseFilters);
    expect(animationFilters.tag).to.equal(AnimationFilters);
  });

  it('should render the CurrentSelections component', () => {
    const currentSelections = vnode.children[2].children[0];
    expect(currentSelections.tag).to.equal(CurrentSelections);
  });

  it('should render the CategoryTree component', () => {
    const categoryTree = vnode.children[3];
    expect(categoryTree.tag).to.equal(CategoryTree);
  });
});
