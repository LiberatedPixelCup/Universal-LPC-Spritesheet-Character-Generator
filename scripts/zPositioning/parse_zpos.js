const testFolder = 'sheet_definitions';
const fs = require('fs');

var csvEntries = [];
const possibleBodies = ["male", "female", "muscular", "pregnant","child"];

fs.readdirSync(testFolder).forEach(file => {
  if (!file.includes('.json')) {
    return
  }
  const json = file;
  const definition = JSON.parse(fs.readFileSync(`sheet_definitions/${file}`));
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
