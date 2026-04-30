// Use this script in order to recompose universal spritesheets from the separate animations.
// This script traverses all files inside `sheetsFolder` and concat the animations
// spellcast, thrust, walk ,slash, shoot, hurt into a new image file
// The new image can be found at the /universal folder of the asset with the variant name.

import fs from "node:fs";
import { execSync } from "node:child_process";
import { debugLog } from "../utils/debug.js";

const walk = function (dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function (file) {
    file = dir + "/" + file;
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      if (file.endsWith("walk")) {
        results.push(file.replace("/walk", ""));
      } else {
        results = results.concat(walk(file));
      }
    }
  });
  return results;
};
const sheetsFolder = "spritesheets";
const walkDirectories = walk(sheetsFolder);
debugLog("file", walkDirectories);

const masterSheetNames = [
  "spellcast",
  "thrust",
  "walk",
  "slash",
  "shoot",
  "hurt",
];
walkDirectories.forEach(function (walkDirectory) {
  debugLog(`Start processing sheet: ${walkDirectory}`);
  const list = fs.readdirSync(walkDirectory + "/walk");
  let variants = [];
  list.forEach(function (file) {
    if (file.includes(".png")) {
      variants.push(file);
    }
  });
  debugLog("variants found", variants);

  const universalFolder = `${walkDirectory}/_universal`;
  if (fs.existsSync(universalFolder)) {
    fs.rmdirSync(universalFolder, { recursive: true, force: true });
  }
  fs.mkdirSync(universalFolder);
  variants.forEach(function (variant) {
    let imagesToCompose = [];
    masterSheetNames.forEach(function (animation) {
      const variantPath = `${walkDirectory}/${animation}/${variant}`;
      if (fs.existsSync(`${walkDirectory}/${animation}/${variant}`)) {
        imagesToCompose.push(variantPath);
      } else {
        debugLog("variantPath does NOT exist", variantPath);
        // TODO: Load a dummy here in order to preserve right sequence
      }
    });
    debugLog("composing images", imagesToCompose);

    const newFile = `${universalFolder}/${variant}`;
    const inputArguments = imagesToCompose.join(" ");
    const command = `magick convert -background transparent -append ${inputArguments} ${newFile}`;
    execSync(command, (err) => {
      if (err) {
        throw err;
      }
    });
  });
});
