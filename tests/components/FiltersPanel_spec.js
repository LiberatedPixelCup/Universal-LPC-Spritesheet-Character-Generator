import { FiltersPanel } from "../../sources/components/FiltersPanel.ts";
import { CollapsibleSection } from "../../sources/components/CollapsibleSection.ts";
import { LicenseFilters } from "../../sources/components/filters/LicenseFilters.ts";
import { AnimationFilters } from "../../sources/components/filters/AnimationFilters.ts";
import { expect } from "chai";
import { describe, it, beforeEach } from "mocha-globals";

describe("FiltersPanel", () => {
  let vnode;

  beforeEach(() => {
    const createLicenseFiltersModel = () => ({ summary: "licenses" });
    const createAnimationFiltersModel = () => ({ summary: "animations" });
    vnode = FiltersPanel.view({
      attrs: {
        createLicenseFiltersModel,
        createAnimationFiltersModel,
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

  it("renders only the two filter groups", () => {
    expect(vnode.children).to.have.lengthOf(1);
    const columns = vnode.children[0].children;
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
});
