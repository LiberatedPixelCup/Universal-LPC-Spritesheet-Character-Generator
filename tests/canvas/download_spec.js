import { expect } from "chai";
import sinon from "sinon";
import { downloadFile } from "../../../sources/canvas/download.js";

describe("downloadFile", () => {
  let createObjectURLStub, revokeObjectURLStub, createElementStub, clickStub;

  beforeEach(() => {
    // Stub browser-specific functions
    createObjectURLStub = sinon.stub(URL, "createObjectURL").returns("blob:url");
    revokeObjectURLStub = sinon.stub(URL, "revokeObjectURL");
    const createElement = document.createElement;
    createElementStub = sinon.stub(document, "createElement").callsFake(() => {
      const element = createElement.call(document, "a");
      element.click = sinon.stub();
      clickStub = element.click;
      return element;
    });
  });

  afterEach(() => {
    // Restore stubs
    sinon.restore();
  });

  it("should create a blob and trigger a download with the correct filename and type", () => {
    const content = "Test content";
    const filename = "test.txt";
    const type = "text/plain";

    downloadFile(content, filename, type);

    // Verify createObjectURL was called with a Blob
    expect(createObjectURLStub.calledOnce).to.be.true;
    const blobArg = createObjectURLStub.firstCall.args[0];
    expect(blobArg).to.be.instanceOf(Blob);
    expect(blobArg.type).to.equal(type);

    // Verify the anchor element was created and clicked
    expect(createElementStub.calledOnceWith("a")).to.be.true;
    expect(clickStub.calledOnce).to.be.true;

    // Verify the anchor element's properties
    const anchor = createElementStub.firstCall.returnValue;
    expect(anchor.href).to.equal("blob:url");
    expect(anchor.download).to.equal(filename);

    // Verify revokeObjectURL was called
    expect(revokeObjectURLStub.calledOnceWith("blob:url")).to.be.true;
  });

  it("should use default type if not provided", () => {
    const content = "Test content";
    const filename = "test.txt";

    downloadFile(content, filename);

    // Verify createObjectURL was called with a Blob
    expect(createObjectURLStub.calledOnce).to.be.true;
    const blobArg = createObjectURLStub.firstCall.args[0];
    expect(blobArg).to.be.instanceOf(Blob);
    expect(blobArg.type).to.equal("text/plain");
  });
});