const fs = require('fs');
const path = require("path");
const SHEETS_DIR = "sheet_definitions" + path.sep;

var csvEntries = [];
const possibleBodies = ["male", "female", "muscular", "pregnant","child"];

// Read sheet_definitions/* recursively line by line recursively and extract zPos and image references to write to csv
const files = fs.readdirSync(SHEETS_DIR, { 
  recursive: true,
  withFileTypes: true 
}).sort((a, b) => {
  const pa = path.join(a.path, a.name);
  const pb = path.join(b.path, b.name);

  const depthA = pa.split(path.sep).length;
  const depthB = pb.split(path.sep).length;
  if (depthA !== depthB) return depthA - depthB;

  return pa.localeCompare(pb, ["en"]);
});

files.forEach(file => {
  if (!file.name.includes('.json') || file.isDirectory()) {
    return
  }
  const fullPath = path.join(file.path, file.name);
  const json = file.name.replace('.json', '');
  const definition = JSON.parse(fs.readFileSync(fullPath));
  for (let jdx =1; jdx < 10; jdx++) {
    const layerDefinition = definition[`layer_${jdx}`];
    if (layerDefinition !== undefined) {
      const layer = `layer_${jdx}`;
      const zPos = layerDefinition.zPos;
      var images = "";
      var bodyIndex = 0;
      var firstImage = true;
      for (let item in possibleBodies) {
        const body = possibleBodies[bodyIndex];
        const imageRef = layerDefinition[`${body}`];
        if (imageRef !== undefined) {
          if (!firstImage) {
            images += " "
          }
          images += imageRef;
          firstImage = false;
        }
        bodyIndex+=1;
      }
      csvEntries.push(`${json},${layer},${zPos},${images}`)
    } else {
      return
    }
  }
});

const csvToWrite = "json,layer,zPos,images\n" + csvEntries.sort().join("\n");

fs.writeFile('scripts/zPositioning/z_positions.csv', csvToWrite, function(err) {
  if (err) {
      return console.log(err);
  } else {
      console.log('Updated z_positions.csv!');
  }
});
