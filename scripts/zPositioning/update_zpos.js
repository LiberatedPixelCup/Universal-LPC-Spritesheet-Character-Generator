const fs = require('fs');
const path = require("path");
const SHEETS_DIR = "sheet_definitions" + path.sep;

// Read z positions from csv
const csv = fs.readFileSync('scripts/zPositioning/z_positions.csv').toString().split("\n");

// Read sheet_definitions/*.json line by line recursively and update zPos based on csv
const sheets = fs.readdirSync(SHEETS_DIR, { 
  recursive: true,
  withFileTypes: true 
}).forEach(file => {
  if (!file.name.includes('.json') || file.isDirectory()) {
    return
  }
  const fullPath = path.join(file.parentPath, file.name);
  const definition = JSON.parse(fs.readFileSync(fullPath));
  for (let jdx=1; jdx < 10; jdx++) {
    const layerDefinition = definition[`layer_${jdx}`];
    if (layerDefinition !== undefined) {
      var entryIdx = 0;
      for (let entry in csv) {
        const item = csv[entryIdx];
        if (item.includes(file.name) && item.includes(`layer_${jdx}`)) {
          const requiredZposition = parseInt(item.split(",")[2]);
          definition[`layer_${jdx}`].zPos = requiredZposition;
          try {
            fs.writeFileSync(fullPath, JSON.stringify(definition, null, 2));
            console.log('Updated:', file.name);
          } catch(e) {
            return console.error(e);
          }
        }
        entryIdx += 1;
      }
    } else {
      return
    }
  }
});
