/*

ospec-adapter.js
================

Testem custom adapter for Ospec.

*/

/* globals module */
/* exported ospecAdapter */
"use strict";

function convertBrToNewlines(node) {
	const textWithNewlines = node.innerHTML.replace(/<br\s*\/?>/gi, "\n");
	const finalPlainText = document.createElement("div");
	finalPlainText.innerHTML = textWithNewlines;
	return finalPlainText.textContent;
}

function ospecAdapter(socket) {
	try {
		const Runner = discoverAndRunTests;
		discoverAndRunTests = function () {
			const resultsDiv = document.getElementById("results");
			const statusDiv = document.getElementById("test-status");

			const observer = new MutationObserver((mutationsList) => {
				for (const mutation of mutationsList) {
					const nodes = mutation.addedNodes;
					nodes.forEach((node) => {
						const name = convertBrToNewlines(node);
						socket.emit('test-result', { 
							passed: name.includes('✓') ? 1 : 0,
							failed: name.includes('✗') ? 1 : 0,
							name,
						});
					});
				}
			});

			socket.emit("tests-start");
			observer.observe(resultsDiv, { childList: true, subtree: true });
			Runner.apply(this, arguments);
			socket.emit("all-test-results", {
				passed: statusDiv.textContent === "PASS" ? 1 : 0,
				failed: statusDiv.textContent === "FAIL" ? 1 : 0,
			});
			const status = statusDiv.textContent;
			return status === "PASS" ? 0 : 1;
		};
	} catch (e) {
		console.error("Testem: failed to register adapter for ospec.");
		return 1;
	}
}

Testem.useCustomAdapter(ospecAdapter);

// Exporting this as a module so that it can be unit tested in Node.
if (typeof module !== "undefined") {
	module.exports = ospecAdapter;
}
