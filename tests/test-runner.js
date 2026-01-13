// Test runner script - sets up ospec reporter and discovers/loads tests

const resultsDiv = document.getElementById("results");
const statusDiv = document.getElementById("test-status");
const loadingMsg = document.querySelector(".loading");

// Custom reporter for browser
const customOspecReporter = function(results) {
  try {
    console.log("Custom reporter called with", results.length, "results");

    resultsDiv.innerHTML = "";

    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;

    // In ospec browser mode, results is a flat array of test results
    // Each result has context like "SpecName > testName"
    // Group by spec name (the part before " > ")
    const specGroups = {};

    results.forEach(result => {
      const contextParts = result.context
        ? result.context.split(" > ")
        : ["Unknown"];
      const specName = contextParts[0];
      const testName = contextParts.slice(1).join(" > ") || result.message;

      if (!specGroups[specName]) {
        specGroups[specName] = [];
      }
      specGroups[specName].push({
        name: testName,
        pass: result.pass,
        error: result.error,
        message: result.message
      });
    });

    // Now display grouped results
    Object.keys(specGroups).forEach(specName => {
      const specDiv = document.createElement("div");
      specDiv.className = "spec";
      specDiv.textContent = specName;
      resultsDiv.appendChild(specDiv);

      specGroups[specName].forEach(test => {
        totalTests++;
        const testDiv = document.createElement("div");
        testDiv.className = "test";

        if (test.pass) {
          passedTests++;
          testDiv.innerHTML = `<span class="pass">✓</span> ${test.name}`;
        } else {
          failedTests++;
          testDiv.innerHTML = `<span class="fail">✗</span> ${test.name}`;

          if (test.error) {
            const errorDiv = document.createElement("div");
            errorDiv.className = "error-details";
            errorDiv.textContent =
              test.error.stack || test.error.message || String(test.error);
            testDiv.appendChild(errorDiv);
          }
        }

        resultsDiv.appendChild(testDiv);
      });
    });

    // Summary
    const summaryDiv = document.createElement("div");
    summaryDiv.className =
      failedTests > 0 ? "summary has-fail" : "summary all-pass";
    summaryDiv.textContent = `Total: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests}`;
    resultsDiv.appendChild(summaryDiv);

    // Update status for CI
    statusDiv.textContent = failedTests === 0 ? "PASS" : "FAIL";

    // Signal completion for CI by adding a data attribute
    document.body.setAttribute("data-tests-complete", "true");

    // Remove loading message
    if (loadingMsg) {
      loadingMsg.remove();
    }
  } catch (error) {
    console.error("Error in custom reporter:", error);
    resultsDiv.innerHTML = `<div class="fail">Reporter error: ${error.message}</div>`;
    statusDiv.textContent = "FAIL";
  }
};

// Set the reporter immediately
window.o.reporter = customOspecReporter;

// Autodiscovery: fetch directory listing and load all test files
async function discoverAndRunTests() {
  try {
    // Fetch the /tests/ directory listing
    const response = await fetch("/tests/");

    if (!response.ok) {
      throw new Error(`Failed to fetch /tests/ directory: ${response.status}`);
    }

    const html = await response.text();

    // Parse the HTML directory listing to find all .test.js files
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Find all links in the directory listing
    const links = Array.from(doc.querySelectorAll("a"));

    // Filter for .test.js files
    const testFiles = links
      .map(link => link.getAttribute("href"))
      .filter(href => href && href.endsWith(".test.js"))
      .map(href => {
        // Normalize backslashes to forward slashes (Windows compatibility)
        const normalized = href.replace(/\\/g, "/");
        // Extract just the filename (last segment)
        const filename = normalized.split("/").pop();
        return `/tests/${filename}`;
      });

    console.log("Discovered test files:", testFiles);

    if (testFiles.length === 0) {
      console.warn(
        "No test files found! Make sure your HTTP server provides directory listings."
      );
      console.warn("Directory listing HTML:", html.substring(0, 500));
    }

    // Dynamically import all test files
    const imports = testFiles.map(file => import(file));

    await Promise.all(imports);

    console.log(`Loaded ${testFiles.length} test file(s), running tests...`);

    // Run all tests with custom reporter passed as argument
    window.o.run(customOspecReporter);
  } catch (error) {
    console.error("Error discovering/loading tests:", error);

    if (resultsDiv) {
      resultsDiv.innerHTML = `
        <div class="fail">
          <strong>Error loading tests:</strong><br>
          ${error.message}<br><br>
          <em>Make sure you're running this through an HTTP server (not file:// protocol)
          and that the server provides directory listings for /tests/</em>
        </div>
      `;
    }

    if (statusDiv) {
      statusDiv.textContent = "FAIL";
    }

    throw error;
  }
}

window.discoverAndRunTests = discoverAndRunTests;
