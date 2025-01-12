const fs = require('fs');

const csv = fs.readFileSync('scripts/zPositioning/z_positions.csv').toString().split("\n");

fs.readdirSync('sheet_definitions').forEach(file => {
  if (!file.includes('.json')) {
    return
  }
  const definition = JSON.parse(fs.readFileSync(`sheet_definitions/${file}`));
  for (jdx =1; jdx < 10; jdx++) {
    const layerDefinition = definition[`layer_${jdx}`];
    if (layerDefinition !== undefined) {
      var entryIdx = 0;
      for (entry in csv) {
        const item = csv[entryIdx];
        if (item.includes(file) && item.includes(`layer_${jdx}`)) {
          const requiredZposition = parseInt(item.split(",")[2]);
          definition[`layer_${jdx}`].zPos = requiredZposition;
          fs.writeFileSync(`sheet_definitions/${file}`, JSON.stringify(definition, null, 2), function(err) { });
          console.log('Updated:', file);
        }
        entryIdx += 1;
      }
    } else {
      return
    }
  }
});
