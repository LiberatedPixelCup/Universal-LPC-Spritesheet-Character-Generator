const testFolder = 'sheet_definitions';
const fs = require('fs');

var toWrite = "json,layer,zPos,images\n";
const possibleBodies = ["male", "female", "muscular", "pregnant","child"];

fs.readdirSync(testFolder).forEach(file => {
  if (!file.includes('.json')) {
    return
  }
  const json = file;
  const definition = JSON.parse(fs.readFileSync(`sheet_definitions/${file}`));
  for (jdx =1; jdx < 10; jdx++) {
    const layerDefinition = definition[`layer_${jdx}`];
    if (layerDefinition !== undefined) {
      const layer = `layer_${jdx}`;
      const zPos = layerDefinition.zPos;
      var images = "";
      var bodyIndex = 0;
      var firstImage = true;
      for (item in possibleBodies) {
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
      toWrite+= `${json},${layer},${zPos},${images}\n`
    } else {
      return
    }
  }
});
fs.writeFile('sheet_definitions/z_positions.csv', toWrite, function(err) {
  if (err) {
      return console.log(err);
  } else {
      console.log('Updated!');
  }
});
