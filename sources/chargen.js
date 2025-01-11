_.mixin(_.str.exports());

$.expr[':'].icontains = function(a, i, m) {
  return jQuery(a).text().toUpperCase()
      .indexOf(m[3].toUpperCase()) >= 0;
};

$.fn.reverse = [].reverse;

$(document).ready(function() {

  var matchBodyColor = true;
  var itemsToDraw = [];
  var itemsMeta = {};
  var params = jHash.val();
  var sheetCredits = [];

  var canvas = $("#spritesheet").get(0);
  var ctx = canvas.getContext("2d", { willReadFrequently: true });
  var images = {};
  const universalFrameSize = 64;
  const universalSheetWidth = 832;
  const universalSheetHeight = 2944;

  // Preview Animation
  var anim = $("#previewAnimations").get(0);
  var animCtx = anim.getContext("2d");
  var animationItems = [1, 2, 3, 4, 5, 6, 7, 8]; // default for walk
  var animRowStart = 8; // default for walk
  var animRowNum = 4; // default for walk
  var currentAnimationItemIndex = 0;
  var activeCustomAnimation = "";
  var addedCustomAnimations = [];

  // on hash (url) change event, interpret and redraw
  jHash.change(function() {
    params = jHash.val();
    interpretParams();
    redraw();
  });

  interpretParams();
  if (Object.keys(params).length == 0) {
    $("input[type=reset]").click();
    setParams();
    selectDefaults();
  }
  redraw();
  showOrHideElements();
  nextFrame();

  // set params and redraw when any radio button is clicked on
  $("input[type=radio]").each(function() {
    $(this).click(function() {
      if (matchBodyColor) {
        matchBodyColorForThisAsset = $(this).attr('matchBodyColor')
        if (matchBodyColorForThisAsset && matchBodyColorForThisAsset != 'false') {
          selectColorsToMatch($(this).attr('variant'));
        }
      }
      setParams();
      redraw();
      showOrHideElements();
    });
  });

  // Toggle display of a list elements children when clicked
  // Again, do not multiple toggle when clicking on children
  $("#chooser ul>li").click(function(event) {
    $(this).children("span").toggleClass("condensed").toggleClass("expanded");
    var $ul = $(this).children("ul");
    $ul.toggle('slow').promise().done(drawPreviews);
    event.stopPropagation();
  });

  $("#collapse").click(function() {
    $("#chooser>ul ul").hide('slow');
    $("#chooser>ul span.expanded").removeClass("expanded").addClass("condensed");
  });
  $("#expand").click(function() {
    let parents = $('input[type="radio"]:checked').parents("ul")
    parents.prev('span').addClass("expanded")
    parents.show().promise().done(drawPreviews)
  })

  function search(e) {
    $('.search-result').removeClass('search-result')
    let query = $('#searchbox').val()
    if (query != '' && query.length > 1) {
      let results = $('#chooser span:icontains('+query+')').addClass("search-result")
      let parents = results.parents("ul")
      parents.prev('span').addClass("expanded").removeClass('condensed')
      parents.show().promise().done(drawPreviews)
    }
  }
  $("#searchbox").on('search',search)
  $("#search").click(search)
  $("#customizeChar").on('submit',function(e) {
    search()
    e.preventDefault()
  })

  $('#displayMode-compact').click(function() {
    $('#chooser').toggleClass('compact')
  })

  $('#match_body-color').click(function() {
    matchBodyColor = $(this).is(":checked");
  })

  $('#scroll-to-credits').click(function(e) {
    $('#credits')[0].scrollIntoView()
    e.preventDefault();
  })

  $("#previewFile").change(function() {
    previewFile();
  });

  $("#ZPOS").change(function() {
    previewFile();
  });

  $("#saveAsPNG").click(function() {
    renameImageDownload(this, canvas, 'Download' + Math.floor(Math.random() * 100000) + '.png');
    return true
  });

  $("#resetAll").click(function() {
    window.setTimeout(function() {
      document.getElementById("previewFile").value = "";
      images["uploaded"] = null;
      document.getElementById("ZPOS").value = 0;
      params = {};
      jHash.val(params);
      interpretParams();
      selectDefaults();
      redraw();
      showOrHideElements();
    }, 0, false);
  });

  $(".removeIncompatibleWithLicenses").click(function() {
    const allowedLicenses = getAllowedLicenses();
    $("input[type=radio]").each(function() {      
      // Toggle allowed licenses
      const licenses = $(this).data(`layer_1_${getBodyTypeName()}_licenses`)
      if (licenses !== undefined) {
        const licensesForAsset = licenses.split(",");
        if (!allowedLicenses.some(allowedLicense => licensesForAsset.includes(allowedLicense))) {
          if ($(this).prop("checked")) {
            $(this).attr("checked", false).prop("checked", false);
            $(this).closest('ul').find("input[type=radio][id$=none]").click();
          }
        }
      }
    });
    setParams();
    redraw();
    showOrHideElements();
  });

  $(".replacePinkMask").click(function() {
    var imgData = ctx.getImageData(0, 0, canvas.width, canvas.height),
    pix = imgData.data;

    for (var i = 0, n = pix.length; i <n; i += 4) {
      const a = pix[i+3];
      if (a > 0) {
        const r = pix[i];
        const g = pix[i+1];
        const b = pix[i+2];
        if (r === 255 && g === 44 && b === 230) {
          pix[i + 3] = 0;
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
  });

  $(".generateSheetCreditsCsv").click(function() {
    let bl = new Blob([sheetCreditsToCSV()], {
      type: "text/html"
    });
    let a = document.createElement("a");
    a.href = URL.createObjectURL(bl);
    a.download = "sheet-credits.csv";
    a.hidden = true;
    document.body.appendChild(a);
    a.innerHTML = "dummyhtml";
    a.click();
    document.removeChild(a);
  });

  $(".importFromClipboard").click(async function() {
    var clipboardText = await navigator.clipboard.readText();
    var spritesheet = JSON.parse(clipboardText)["layers"];
    window.setTimeout(function() {
      $("#resetAll").click(); //Reset first so defaults are set properly
    },1,false);
    window.setTimeout(function() {
      setParamsFromImport(spritesheet); //wait for reset function(s) to complete then apply spritesheet
    },2,false);
  });

  $(".exportToClipboard").click(function() {
    var spritesheet = {};
    Object.assign(spritesheet, itemsMeta);
    spritesheet["layers"] = itemsToDraw;
    navigator.clipboard.writeText(JSON.stringify(spritesheet, null, "  "));
  });

  $(".generateSheetCreditsTxt").click(function() {
    let bl = new Blob([sheetCreditsToTxt()], {
      type: "text/html"
    });
    let a = document.createElement("a");
    a.href = URL.createObjectURL(bl);
    a.download = "sheet-credits.txt";
    a.hidden = true;
    document.body.appendChild(a);
    a.innerHTML = "dummyhtml";
    a.click();
    document.removeChild(a);
  });

  $("#whichAnim").change(function() {
    animationItems = [];
    const selectedAnim = $("#whichAnim>:selected");
    const selectedAnimationValue = $("#whichAnim>:selected").text()
    const animRowFrames = parseInt(selectedAnim.data("cycle"));
    animRowStart = parseInt(selectedAnim.data("row"));
    animRowNum = parseInt(selectedAnim.data("num"));

    currentAnimationItemIndex = 0;
    if (addedCustomAnimations.includes(selectedAnimationValue)) {
      activeCustomAnimation = selectedAnimationValue;
    }
    if (activeCustomAnimation !== "") {
      const selectedCustomAnimation = customAnimations[activeCustomAnimation];
      animRowNum = selectedCustomAnimation.frames.length;
      animRowStart = 0;
      for (var i = 0; i < selectedCustomAnimation.frames[0].length; ++i) {
        if (selectedCustomAnimation.skipFirstFrameInPreview && i === 0  ) {
          continue;
        }
        animationItems.push(i);
      }
      return
    }
    const animRowFramesCustom = selectedAnim.data("cycle-custom");
    if (animRowFramesCustom !== undefined) {
      animationItems = animRowFramesCustom.split('-').map(Number);
      if (animationItems.length > 0) {
        return;
      }
    }
    for (var i = 1; i < animRowFrames; ++i) {
      animationItems.push(i);
    }
  });

  function clearCustomAnimationPreviews() {
    for (var i = 0; i < addedCustomAnimations.length; ++i) {
      $('#whichAnim').children(`option[value=${addedCustomAnimations[i]}]`).remove();
    }
  }

  function addCustomAnimationPreviews() {
    clearCustomAnimationPreviews();
    for (var i = 0; i < addedCustomAnimations.length; ++i) {
      $('#whichAnim').append(new Option(`${addedCustomAnimations[i]}`, `${addedCustomAnimations[i]}`))
    }
  }

  $("#spritesheet,#previewAnimations").on('click',function(e) {
    $(this).toggleClass('zoomed')
  })

  function selectDefaults() {
    $(`#${"body-Body_color_light"}`).prop("checked", true);
    $(`#${"head-Human_male_light"}`).prop("checked", true);
    setParams();
  }

  function selectColorsToMatch(variant) {
    const colorToMatch = variant;
    $("input[matchBodyColor^=true]:checked").each(function() {
      // 1. Determine the type of asset that is selected (eg. human male)
      const assetType = $(this).attr('parentName').replaceAll(" ", "_");
      // 2. Determine the color of asset that needs to selected (eg. head-human_male_light)
      const assetToSelect =  $(this).attr('name') + "-" + assetType + "_" + colorToMatch;
      $(`#${assetToSelect}`).prop("checked", true);
    })
    setParams();
  }

  function addCreditFor(fileName, licenses, authors, urls, notes) {
    if (fileName !== "") {
      let credit = {};
      credit.fileName = fileName;
      credit.licenses = licenses;
      credit.authors = authors;
      credit.urls = urls;
      credit.notes = notes;
      sheetCredits.push(credit);
    }
  }

  function sheetCreditsToCSV() {
    const header = "filename,notes,authors,licenses,urls";
    var csvBody = header + "\n";
    sheetCredits.map(function(credit) {
      if (credit.licenses !== undefined) {
        csvBody+=`${credit.fileName},\"${credit.notes}\",\"${credit.authors}\",\"${credit.licenses}\",\"${credit.urls}\"`;
        csvBody+="\n";
      }
    })
    return csvBody;
  }

  function sheetCreditsToTxt() {
    var creditString = "";
    sheetCredits.map(function(credit) {
      if (credit.licenses !== undefined) {
        const licensesForDisplay = `- Licenses:\n\t\t- ${credit.licenses.replaceAll(",", "\n\t\t- ")}`;
        const authorsForDisplay = `- Authors:\n\t\t- ${credit.authors.replaceAll(",", "\n\t\t- ")}`;
        const linksForDisplay = `- Links:\n\t\t- ${credit.urls.replaceAll(",", "\n\t\t- ")}`;
        const notesForDisplay = `- Note: ${credit.notes}`;
        let creditEntry = `${credit.fileName}\n\t${notesForDisplay}\n\t${licensesForDisplay}\n\t${authorsForDisplay}\n\t${linksForDisplay}\n\n`;
        creditString+=creditEntry;
      }
    })
    return creditString;
  }

  function previewFile(){
    var file = document.querySelector('input[type=file]').files[0];
    var img = new Image;
    img.onload = function() {
      images["uploaded"] = img;
      redraw();
      showOrHideElements();
    }
    img.src = URL.createObjectURL(file);
  }

  function renameImageDownload(link, canvasItem, filename) {
    link.href = canvasItem.toDataURL();
    link.download = filename;
  };

  function getBodyTypeName() {
    if ($("#sex-male").prop("checked")) {
      return "male";
    } else if ($("#sex-female").prop("checked")) {
      return "female";
    } else if ($("#sex-teen").prop("checked")) {
      return "teen";
    } else if ($("#sex-child").prop("checked")) {
      return "child";
    } else if ($("#sex-muscular").prop("checked")) {
      return "muscular";
    } else if ($("#sex-pregnant").prop("checked")) {
      return "pregnant";
    }
    return "ERROR";
  }

  function getSelectedAnimation() {
    if ($("[name=animation]:checked").length > 0) {
      return $("[name=animation]:checked").prop("id").replace("animation-", "");
    }
    return "any";
  }

  $('.licenseCheckBox').click(function() {
    showOrHideElements();
  })

  function getAllowedLicenses() {
    return  $('.licenseCheckBox:checkbox:checked').map(function() {
      return $(this).val().split(",");
    }).get().map(license => license.trim());
  }

  function redraw() {
    itemsToDraw = [];
    const bodyTypeName = getBodyTypeName();

    sheetCredits = [];
    var baseUrl = window.location.href.split("/").slice(0, -1).join("/"); // get url until last '/'

    itemsMeta = {"bodyTypeName":bodyTypeName,
                 "url":window.location.href,
                 "spritesheets":baseUrl+"/spritesheets/",   // <- holds base URL to spritesheets (used to download them)
                 "version":1,                               // <- to track future compatibilty breaking changes
                 "datetime": (new Date().toLocaleString()),
                 "credits":""}

    zPosition = 0;
    $("input[type=radio]:checked").each(function(index) {
      for (jdx =1; jdx < 10; jdx++) {
        if ($(this).data(`layer_${jdx}_${bodyTypeName}`)) {
          const zPos = $(this).data(`layer_${jdx}_zpos`);
          const custom_animation = $(this).data(`layer_${jdx}_custom_animation`);
          const fileName = $(this).data(`layer_${jdx}_${bodyTypeName}`);
          const parentName = $(this).attr(`name`);
          const name = $(this).attr(`parentName`);
          const variant = $(this).attr(`variant`);
          const licenses = $(this).data(`layer_${jdx}_${bodyTypeName}_licenses`);
          const authors = $(this).data(`layer_${jdx}_${bodyTypeName}_authors`);
          const urls = $(this).data(`layer_${jdx}_${bodyTypeName}_urls`);
          const notes = $(this).data(`layer_${jdx}_${bodyTypeName}_notes`);

          if (fileName !== "") {
            const itemToDraw = {};
            itemToDraw.fileName = fileName;
            itemToDraw.zPos = zPos;
            itemToDraw.custom_animation = custom_animation;
            itemToDraw.parentName = parentName
            itemToDraw.name = name
            itemToDraw.variant = variant
            addCreditFor(fileName, licenses, authors, urls, notes);
            itemsToDraw.push(itemToDraw);
          }
        } else {
          break;
        }
      }
    });
    const creditsTxt = sheetCreditsToTxt()
    $("textarea#creditsText").val(creditsTxt);
    itemsMeta["credits"] = creditsTxt;

    if (images["uploaded"] != null) {
      const itemToDraw = {};
      itemToDraw.fileName = "uploaded";
      itemToDraw.zPos = parseInt(document.getElementById("ZPOS").value) || 0;
      itemsToDraw.push(itemToDraw);
    }
    drawItems(itemsToDraw);
  }

  function drawItems(itemsToDraw) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    var requiredCanvasHeight = universalSheetHeight;
    var requiredCanvasWidth = universalSheetWidth;
    clearCustomAnimationPreviews();
    addedCustomAnimations = [];
    for (var i = 0; i < itemsToDraw.length; ++i) {
      const customAnimationString = itemsToDraw[i].custom_animation;
      if (customAnimationString !== undefined) {
        if (addedCustomAnimations.includes(customAnimationString)) {
          continue;
        }
        addedCustomAnimations.push(customAnimationString);
        const customAnimation = customAnimations[customAnimationString];
        const customAnimationWidth = customAnimation.frameSize * customAnimation.frames[0].length;
        const customAnimationHeight = customAnimation.frameSize * customAnimation.frames.length;
        requiredCanvasWidth = Math.max(requiredCanvasWidth, customAnimationWidth);
        requiredCanvasHeight = requiredCanvasHeight + customAnimationHeight;
      }
    }
    canvas.width = requiredCanvasWidth;
    canvas.height = requiredCanvasHeight;

    $("#chooser").css("height", canvas.height);

    var itemIdx = 0;
    var didPutUniversalForCustomAnimation = "";
    itemsToDraw.sort(function(lhs, rhs) {
      return parseInt(lhs.zPos) - parseInt(rhs.zPos);
    });
    for (item in itemsToDraw) {
      const fileName = itemsToDraw[itemIdx].fileName;
      const img = getImage(fileName);
      const custom_animation = itemsToDraw[itemIdx].custom_animation;

      if (custom_animation !== undefined) {
        const customAnimationDefinition = customAnimations[custom_animation];
        const frameSize = customAnimationDefinition.frameSize;

        const customAnimationCanvas=document.createElement("canvas");
        customAnimationCanvas.width=requiredCanvasWidth;
        customAnimationCanvas.height=requiredCanvasHeight-universalSheetHeight;
        const customAnimationContext=customAnimationCanvas.getContext("2d");

        const indexInArray = addedCustomAnimations.indexOf(custom_animation);
        var offSetInAdditionToOtherCustomActions = 0;
        for (var i = 0; i <indexInArray; ++i) {
          const otherCustomAction = customAnimations[addedCustomAnimations[i]];
          offSetInAdditionToOtherCustomActions+=otherCustomAction.frameSize * otherCustomAction.frames.length
        }

        if (didPutUniversalForCustomAnimation !== custom_animation) {
          for (var i = 0; i < customAnimationDefinition.frames.length; ++i) {
            const frames = customAnimationDefinition.frames[i];
            for (var j = 0; j < frames.length; ++j) {
              const frameCoordinateX = parseInt(frames[j].split(",")[1]);
              const frameCoordinateRowName = frames[j].split(",")[0];
              const frameCoordinateY = animationRowsLayout[frameCoordinateRowName]+1;
              const offSet = (frameSize-universalFrameSize)/2;

              var imgDataSingleFrame = ctx.getImageData(universalFrameSize * frameCoordinateX, universalFrameSize * frameCoordinateY, universalFrameSize, universalFrameSize);
              customAnimationContext.putImageData(imgDataSingleFrame, frameSize * j + offSet, frameSize * i + offSet + offSetInAdditionToOtherCustomActions);
            }
          }
          ctx.drawImage(customAnimationCanvas, 0, universalSheetHeight);
          if (itemsToDraw[itemIdx].zPos >= 140) {
            didPutUniversalForCustomAnimation = custom_animation;
          }
        }
        ctx.drawImage(img, 0, universalSheetHeight+offSetInAdditionToOtherCustomActions);
      } else {
        drawImage(ctx, img);
      }
      itemIdx+=1;
    }
    addCustomAnimationPreviews();
  }

  function showOrHideElements() {
    const bodyType = getBodyTypeName();
    const selectedAnim = getSelectedAnimation();
    const allowedLicenses = getAllowedLicenses();
    $("li").each(function(index) {
      // Toggle Required Body Type
      var display = true;
      if ($(this).data("required")) {
        var requiredTypes = $(this).data("required").split(",");
        if (!requiredTypes.includes(bodyType)) {
          display = false;
        }
      }

      // Toggle Required Animations
      if ($(this).data("animations") && selectedAnim !== 'any') {
        var requiredAnimations = $(this).data("animations").split(",");
        if (!requiredAnimations.includes(selectedAnim)) {
          display = false;
        }
      }

      // Display Result
      if(display) {
        $(this).prop("style", "");
      } else {
        $(this).prop("style", "display:none");
      }
    });

    let hasProhibited = false;

    $("input[type=radio]").each(function() {
      var display = true;
      
      // Toggle allowed licenses
      const licenses = $(this).data(`layer_1_${getBodyTypeName()}_licenses`)
      if (licenses !== undefined) {
        const licensesForAsset = licenses.split(",");
        if (!allowedLicenses.some(allowedLicense => licensesForAsset.includes(allowedLicense))) {
          display = false;
          if ($(this).prop("checked")) {
            hasProhibited = true;
          }
        }
      }

      // Display Result
      if(display) {
        $(this).parent().prop("style", "");
      } else {
        $(this).parent().prop("style", "display:none");
      }
    });

    if (hasProhibited) {
      $(".removeIncompatibleWithLicenses").show();
    } else {
      $(".removeIncompatibleWithLicenses").hide();
    }
  }

  function interpretParams() {
    $("input[type=radio]").reverse().each(function() {
      var words = _.words($(this).attr('id'), '-');
      var initial = _.initial(words).join('-');
      $(this).prop("checked", $(this).attr("checked") || params[initial] == _.last(words));
    });
  }

  function setParams() {
    $("input[type=radio]:checked").each(function() {
      var words = _.words($(this).attr('id'), '-');
      var initial = _.initial(words).join('-');
      if (!$(this).attr("checked") || params[initial]) {
        params[initial] = _.last(words);
      }
    });
    jHash.val(params);
  }

  function setParamsFromImport(spritesheet){
    spritesheet.forEach((sprite)=>{
      var name = sprite.name;
      var parentName = sprite.parentName;
      var variant = sprite.variant;
      const assetType = name.replaceAll(" ", "_");
      const assetVariant = variant.replaceAll(" ", "_")
      const assetToSelect = parentName + "-" + assetType + "_" + assetVariant;
      $(`#${assetToSelect}`).prop("checked", true);

    });
    setParams();
  }

  function getImage(imgRef) {
    if (images[imgRef])
      return images[imgRef];
    else {
      var img = new Image();
      img.src = "spritesheets/" + imgRef;
      img.onload = redraw;
      images[imgRef] = img;
      return img;
    }
  }

  function getImage2(imgRef, callback, layers, prevctx) {
    if (imgRef && images[imgRef]) {
      callback(layers, prevctx);
      return images[imgRef];
    } else if (imgRef) {
      var img = new Image();
      img.src = "spritesheets/" + imgRef;
      img.onload = function() { callback(layers, prevctx) };
      images[imgRef] = img;
      return img;
    }
  }

  function drawImage(ctx, img) {
    try {
      ctx.drawImage(img, 0, 0);
      zPosition++;
    } catch(err) {
      console.error("Error: could not find " + img.src);
    }
  }

  function drawPreviews() {
    this.find("input[type=radio]").filter(function() {
      return $(this).is(":visible");
    }).each(function() {
      $this = $(this)
      if (!$this.parent().hasClass("hasPreview") && !$this.parent().hasClass("noPreview")) {
        var prev = document.createElement("canvas");
        prev.setAttribute("width", universalFrameSize);
        prev.setAttribute("height", universalFrameSize);
        var prevctx = prev.getContext("2d");
        var img = null;
        const previewRow = parseInt($(this).data("preview_row"));
        const previewColumn = parseInt($(this).data("preview_column"));
        const previewXOffset = parseInt($(this).data("preview_x_offset"));
        const previewYOffset = parseInt($(this).data("preview_y_offset"));
        var callback = function(layers,prevctx) {
          for(index = 0; index < layers.length; index++){
            if(!images[layers[index].link]){
              return;
            }
          }
          try {
            layers.forEach((layer) => {
              if (layer && layer.link) {
                prevctx.drawImage(images[layer.link], previewColumn * universalFrameSize + previewXOffset, previewRow * universalFrameSize + previewYOffset, universalFrameSize, universalFrameSize, 0, 0, universalFrameSize, universalFrameSize);
              }
            });
          } catch (err) {
            console.error(err);
          }
        };

        layers = []
        const previewToDraw = {};
        const animation =  $(this).data(`layer_1_custom_animation`);

        if($(this).data(`layer_1_${getBodyTypeName()}`) === undefined){
          previewToDraw.link = $(this).data(`layer_1_${getBodyTypeName()}`);
          previewToDraw.zPos = $(this).data(`layer_1_zpos`);
          layers.push(previewToDraw);
        } else{
          for(jdx = 1; jdx < 10; jdx++){
            if($(this).data(`layer_${jdx}_${getBodyTypeName()}`)){
              if(animation === $(this).data(`layer_${jdx}_custom_animation`)){
                const previewToDraw = {};
                previewToDraw.link = $(this).data(`layer_${jdx}_${getBodyTypeName()}`);
                previewToDraw.zPos = $(this).data(`layer_${jdx}_zpos`);
                layers.push(previewToDraw);
              }

            } else {
              break;
            }
          }    
        }
        
        layers.sort(function(lhs, rhs) {
          return parseInt(lhs.zPos) - parseInt(rhs.zPos);
        });
       
        layers.forEach((layer) =>{
          img = getImage2(layer.link, callback, layers, prevctx);
        });

        if (img != null) {
          this.parentNode.insertBefore(prev, this);
          $(this).parent().addClass("hasPreview").parent().addClass("hasPreview");
        }
      }
    });
  };

  function nextFrame() {
    animCtx.clearRect(0, 0, anim.width, anim.height);
    currentAnimationItemIndex = (currentAnimationItemIndex + 1) % animationItems.length;
    const currentFrame = animationItems[currentAnimationItemIndex];
    var frameSize = universalFrameSize;
    var offSet = 0;
    if (activeCustomAnimation !== "") {
      const customAnimation = customAnimations[activeCustomAnimation];
      frameSize = customAnimation.frameSize;
      const indexInArray = addedCustomAnimations.indexOf(activeCustomAnimation);
      offSet = universalSheetHeight;
      for (var i = 0; i <indexInArray; ++i) {
        const otherCustomAction = customAnimations[addedCustomAnimations[i]];
        offSet+=otherCustomAction.frameSize * otherCustomAction.frames.length
      }
    }
    for (var i = 0; i < animRowNum; ++i) {
      animCtx.drawImage(canvas, currentFrame * frameSize, offSet + ((animRowStart + i) * frameSize), frameSize, frameSize, i * frameSize, 0, frameSize, frameSize);
    }
    setTimeout(nextFrame, 1000 / 8);
  }
});