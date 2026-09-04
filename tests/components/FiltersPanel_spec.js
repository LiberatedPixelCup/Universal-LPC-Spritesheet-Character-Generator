import { FiltersPanel } from "../../sources/components/FiltersPanel.ts";
import { CollapsibleSection } from "../../sources/components/CollapsibleSection.ts";
import { SearchControl } from "../../sources/components/filters/SearchControl.ts";
import { LicenseFilters } from "../../sources/components/filters/LicenseFilters.ts";
import { AnimationFilters } from "../../sources/components/filters/AnimationFilters.ts";
import { CurrentSelections } from "../../sources/components/selections/CurrentSelections.ts";
import { CategoryTree } from "../../sources/components/tree/CategoryTree.ts";
import { expect } from "chai";
import { describe, it, beforeEach } from "mocha-globals";

describe("FiltersPanel", () => {
  let vnode;

  beforeEach(() => {
    const createSearchControlModel = () => ({ value: "", disabled: false });
    const createLicenseFiltersModel = () => ({ summary: "licenses" });
    const createAnimationFiltersModel = () => ({ summary: "animations" });
    const createCurrentSelectionsModel = () => ({ kind: "empty" });
    const createCategoryTreeModel = () => ({ isLoading: true });
    vnode = FiltersPanel.view({
      attrs: {
        createSearchControlModel,
        createLicenseFiltersModel,
        createAnimationFiltersModel,
        createCurrentSelectionsModel,
        createCategoryTreeModel,
      },
    });
  });

  it("should render the CollapsibleSection component with correct attributes", () => {
    expect(vnode.tag).to.equal(CollapsibleSection);
    expect(vnode.attrs).to.deep.include({
      title: "Filters",
      defaultOpen: true,
    });
  });

  it("should render the SearchControl component", () => {
    const searchControl = vnode.children[0].children[0];
    expect(searchControl.tag).to.equal(SearchControl);
    expect(searchControl.attrs.createModel()).to.deep.equal({
      value: "",
      disabled: false,
    });
  });

  it("should render LicenseFilters and AnimationFilters in a responsive wrapper", () => {
    const columns = vnode.children[1].children;
    expect(columns).to.have.lengthOf(2);

    const licenseFilters = columns[0].children[0];
    const animationFilters = columns[1].children[0];

    expect(licenseFilters.tag).to.equal(LicenseFilters);
    expect(animationFilters.tag).to.equal(AnimationFilters);
    expect(licenseFilters.attrs.createModel()).to.deep.equal({
      summary: "licenses",
    });
    expect(animationFilters.attrs.createModel()).to.deep.equal({
      summary: "animations",
    });
  });

  it("should render the CurrentSelections component", () => {
    const currentSelections = vnode.children[2].children[0];
    expect(currentSelections.tag).to.equal(CurrentSelections);
    expect(currentSelections.attrs.createModel()).to.deep.equal({
      kind: "empty",
    });
  });

  it("should render the CategoryTree component", () => {
    const categoryTree = vnode.children[3];
    expect(categoryTree.tag).to.equal(CategoryTree);
    expect(categoryTree.attrs.createModel()).to.deep.equal({ isLoading: true });
  });
});
