_.mixin(_.str.exports());

$.expr[":"].icontains = function (a, i, m) {
  return jQuery(a).text().toUpperCase().indexOf(m[3].toUpperCase()) >= 0;
};

// DEBUG mode will be turned on if on localhost and off in production
// but this can be overridden by adding debug=(true|false) to the querystring.
/*
debug isLocalhost result
true  true        true
true  false       true
false true        false
false false       false
unset true        true
unset false       false
*/
const boolMap = {
  true: true,
  false: false,
};
const bool = (s) => boolMap[s] ?? null;
const isLocalhost = window.location.hostname === "localhost";
const debugQueryString = () => bool(jHash.val("debug"));
const DEBUG = debugQueryString() ?? isLocalhost;

$(document).ready(function () {
  var matchBodyColor = true;
  var itemsToDraw = [];
  var itemsMeta = {};
  var params = jHash.val();
  var sheetCredits = [];

  let imagesToLoad = 0;
  let imagesLoaded = 0;
  let didStartRenderAfterLoad = false;

  const canvas = $("#spritesheet").get(0);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const images = {};
  const universalFrameSize = 64;
  const universalSheetWidth = 832;
  const universalSheetHeight = 3456;

  const base_animations = {
    spellcast: 0,
    thrust: 4 * universalFrameSize,
    walk: 8 * universalFrameSize,
    slash: 12 * universalFrameSize,
    shoot: 16 * universalFrameSize,
    hurt: 20 * universalFrameSize,
    climb: 21 * universalFrameSize,
    idle: 22 * universalFrameSize,
    jump: 26 * universalFrameSize,
    sit: 30 * universalFrameSize,
    emote: 34 * universalFrameSize,
    run: 38 * universalFrameSize,
    combat_idle: 42 * universalFrameSize,
    backslash: 46 * universalFrameSize,
    halfslash: 50 * universalFrameSize,
  };

  // Preview Animation
  let past = Date.now();
  var anim = $("#previewAnimations").get(0);
  var animCtx = anim.getContext("2d");
  var animationItems = [1, 2, 3, 4, 5, 6, 7, 8]; // default for walk
  var animRowStart = 8; // default for walk
  var animRowNum = 4; // default for walk
  let currentAnimationItemIndex = 0;
  let activeCustomAnimation = "";
  var addedCustomAnimations = [];

  // on hash (url) change event, interpret and redraw
  jHash.change(function () {
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
  $("input[type=radio]").each(function () {
    $(this).click(function () {
      if (matchBodyColor) {
        matchBodyColorForThisAsset = $(this).attr("matchBodyColor");
        if (
          matchBodyColorForThisAsset &&
          matchBodyColorForThisAsset != "false"
        ) {
          selectColorsToMatch($(this).attr("variant"));
        }
      }
      setParams();
      redraw();
      showOrHideElements();
    });
  });

  // Toggle display of a list elements children when clicked
  // Again, do not multiple toggle when clicking on children
  $("#chooser ul>li").click(function (event) {
    $(this).children("span").toggleClass("condensed").toggleClass("expanded");
    var $ul = $(this).children("ul");
    $ul.toggle("slow").promise().done(drawPreviews);
    event.stopPropagation();
  });

  $("#collapse").click(function () {
    $("#chooser>ul ul").hide("slow");
    $("#chooser>ul span.expanded")
      .removeClass("expanded")
      .addClass("condensed");
  });
  $("#expand").click(function () {
    let parents = $('input[type="radio"]:checked').parents("ul");
    parents.prev("span").addClass("expanded").removeClass("condensed");
    parents.show().promise().done(drawPreviews);
  });

  function search() {
    $(".search-result").removeClass("search-result");
    let query = $("#searchbox").val();
    if (query != "" && query.length > 1) {
      let results = $("#chooser span:icontains(" + query + ")").addClass(
        "search-result"
      );
      const matches = results.length;
      $('#matches').text(`${matches} matches.`);
      let parents = results.parents("ul");
      parents = parents.filter(function() {
        return $(this).find("li>ul").length > 1;
      });
      parents.prev("span").addClass("expanded").removeClass("condensed");
      for (const parent of parents.toArray().reverse()) {
        $(parent).delay(50).show();
      }
    }
  }
  $("#searchbox").on("search", search);
  $("#search").click(search);
  $("#searchbox").on("input", function() {
    if ($("#searchbox").val().length >= 3) {
      (_.debounce(search, 500, false))();
    } else {
      $("#matches").val("");
    }
  });
  $("#customizeChar").on("submit", function (e) {
    search();
    e.preventDefault();
  });

  $("#displayMode-compact").click(function () {
    $("#chooser").toggleClass("compact");
  });

  $("#match_body-color").click(function () {
    matchBodyColor = $(this).is(":checked");
  });

  $("#scroll-to-credits").click(function (e) {
    $("#credits")[0].scrollIntoView();
    e.preventDefault();
  });

  $("#previewFile").change(function () {
    previewFile();
  });

  $("#ZPOS").change(function () {
    previewFile();
  });

  $("#saveAsPNG").click(function () {
    renameImageDownload(
      this,
      canvas,
      "Download" + Math.floor(Math.random() * 100000) + ".png"
    );
    return true;
  });

  $("#resetAll").click(function () {
    window.setTimeout(
      function () {
        document.getElementById("previewFile").value = "";
        images["uploaded"] = null;
        document.getElementById("ZPOS").value = 0;
        params = {};
        jHash.val(params);
        interpretParams();
        selectDefaults();
        redraw();
        showOrHideElements();
      },
      0,
      false
    );
  });

  $(".removeIncompatibleWithLicenses").click(function () {
    const allowedLicenses = getAllowedLicenses();
    $("input[type=radio]").each(function () {
      // Toggle allowed licenses
      const licenses = $(this).data(`layer_1_${getBodyTypeName()}_licenses`);
      if (licenses !== undefined) {
        const licensesForAsset = licenses.split(",");
        if (
          !allowedLicenses.some((allowedLicense) =>
            licensesForAsset.includes(allowedLicense)
          )
        ) {
          if ($(this).prop("checked")) {
            $(this).attr("checked", false).prop("checked", false);
            $(this).closest("ul").find("input[type=radio][id*=none]").click();
          }
        }
      }
    });
    setParams();
    redraw();
    showOrHideElements();
  });

  $(".removeUnsupported").click(function () {
    const selectedAnims = getSelectedAnimations();
    $("input[type=radio]").each(function () {
      const $li = $(this).closest("li[data-animations]");
      if ($li.data("animations") && selectedAnims.length > 0) {
        const requiredAnimations = $li.data("animations").split(",");
        for (const selectedAnim of selectedAnims) {
          if (!requiredAnimations.includes(selectedAnim)) {
            if ($(this).prop("checked")) {
              $(this).attr("checked", false).prop("checked", false);
              $(this)
                .closest("ul")
                .find("input[type=radio][id*=none]:not(:checked)")
                .click();
            }
          }
        }
      }
    });
    setParams();
    redraw();
    showOrHideElements();
    return false;
  });

  $(".replacePinkMask").click(function () {
    var imgData = ctx.getImageData(0, 0, canvas.width, canvas.height),
      pix = imgData.data;

    for (var i = 0, n = pix.length; i < n; i += 4) {
      const a = pix[i + 3];
      if (a > 0) {
        const r = pix[i];
        const g = pix[i + 1];
        const b = pix[i + 2];
        if (r === 255 && g === 44 && b === 230) {
          pix[i + 3] = 0;
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
  });

  $(".generateSheetCreditsCsv").click(function () {
    let bl = new Blob([sheetCreditsToCSV()], {
      type: "text/html",
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

  $(".importFromClipboard").click(async function () {
    var clipboardText = await navigator.clipboard.readText();
    var spritesheet = JSON.parse(clipboardText)["layers"];
    window.setTimeout(
      function () {
        $("#resetAll").click(); //Reset first so defaults are set properly
      },
      1,
      false
    );
    window.setTimeout(
      function () {
        setParamsFromImport(spritesheet); //wait for reset function(s) to complete then apply spritesheet
      },
      2,
      false
    );
  });

  $(".exportToClipboard").click(function () {
    var spritesheet = {};
    Object.assign(spritesheet, itemsMeta);
    spritesheet["layers"] = itemsToDraw;
    navigator.clipboard.writeText(JSON.stringify(spritesheet, null, "  "));
  });

  $(".generateSheetCreditsTxt").click(function () {
    let bl = new Blob([sheetCreditsToTxt()], {
      type: "text/html",
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

  $("#frame-cycle").text(animationItems.join("-")); // for default animation, walk

  $("#whichAnim").change(function () {
    animationItems = [];
    const selectedAnim = $("#whichAnim>:selected");
    const selectedAnimationValue = $("#whichAnim>:selected").text();
    const animRowFrames = parseInt(selectedAnim.data("cycle"));
    animRowStart = parseInt(selectedAnim.data("row"));
    animRowNum = parseInt(selectedAnim.data("num"));

    currentAnimationItemIndex = 0;
    activeCustomAnimation = "";
    if (addedCustomAnimations.includes(selectedAnimationValue)) {
      activeCustomAnimation = selectedAnimationValue;
    }
    if (activeCustomAnimation !== "") {
      const selectedCustomAnimation = customAnimations[activeCustomAnimation];
      animRowNum = selectedCustomAnimation.frames.length;
      animRowStart = 0;
      for (var i = 0; i < selectedCustomAnimation.frames[0].length; ++i) {
        if (selectedCustomAnimation.skipFirstFrameInPreview && i === 0) {
          continue;
        }
        animationItems.push(i);
      }
      $("#frame-cycle").text(animationItems.join("-"));
      return;
    }
    const animRowFramesCustom = selectedAnim.data("cycle-custom");
    if (animRowFramesCustom !== undefined) {
      animationItems = animRowFramesCustom.split("-").map(Number);
      if (animationItems.length > 0) {
        $("#frame-cycle").text(animRowFramesCustom);
        return;
      }
    }
    for (var i = 1; i < animRowFrames; ++i) {
      animationItems.push(i);
    }
    $("#frame-cycle").text(animationItems.join("-"));
  });

  function clearCustomAnimationPreviews() {
    for (var i = 0; i < addedCustomAnimations.length; ++i) {
      $("#whichAnim")
        .children(`option[value=${addedCustomAnimations[i]}]`)
        .remove();
    }
  }

  function addCustomAnimationPreviews() {
    clearCustomAnimationPreviews();
    for (var i = 0; i < addedCustomAnimations.length; ++i) {
      $("#whichAnim").append(
        new Option(`${addedCustomAnimations[i]}`, `${addedCustomAnimations[i]}`)
      );
    }
  }

  $("#spritesheet,#previewAnimations").on("click", function (e) {
    $(this).toggleClass("zoomed-in");
  });
  $("#spritesheet,#previewAnimations").on("dblclick", function (e) {
    $(this).toggleClass("zoomed-out");
  });

  const spritesheetGesture = new TinyGesture(document.getElementById('spritesheet'), { mouseSupport: false });
  const previewAnimationsGesture = new TinyGesture(document.getElementById('previewAnimations'), { mouseSupport: false });

  spritesheetGesture.on('pinch', pinch.bind(spritesheetGesture));
  previewAnimationsGesture.on('pinch', pinch.bind(previewAnimationsGesture));
  spritesheetGesture.on('pinchend', pinchEnd);
  previewAnimationsGesture.on('pinchend', pinchEnd);

  let initialZoom = null;
  function pinch(event) {
    const scale = this.scale;
    const $target = $(event.target);
    if (initialZoom === null) {
      initialZoom = $target.css('zoom') ?? 1;
    }
    $target.css('zoom', initialZoom * scale);
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function pinchEnd() {
    initialZoom = null;
  }

  function selectDefaults() {
    $(`#${"body-Body_color_light"}`).prop("checked", true);
    $(`#${"head-Human_male_light"}`).prop("checked", true);
    setParams();
  }

  function selectColorsToMatch(variant) {
    const colorToMatch = variant;
    $("input[matchBodyColor^=true]:checked").each(function () {
      // 1. Determine the type of asset that is selected (eg. human male)
      const assetType = $(this).attr("parentName").replaceAll(" ", "_");
      // 2. Determine the color of asset that needs to selected (eg. head-human_male_light)
      const assetToSelect =
        $(this).attr("name") + "-" + assetType + "_" + colorToMatch;
      $(`#${assetToSelect}`).prop("checked", true);
    });
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
    sheetCredits.map(function (credit) {
      if (credit.licenses !== undefined) {
        csvBody += `${credit.fileName},\"${credit.notes}\",\"${credit.authors}\",\"${credit.licenses}\",\"${credit.urls}\"`;
        csvBody += "\n";
      }
    });
    return csvBody;
  }

  function sheetCreditsToTxt() {
    var creditString = "";
    sheetCredits.map(function (credit) {
      if (credit.licenses !== undefined) {
        const licensesForDisplay = `- Licenses:\n\t\t- ${credit.licenses.replaceAll(
          ",",
          "\n\t\t- "
        )}`;
        const authorsForDisplay = `- Authors:\n\t\t- ${credit.authors.replaceAll(
          ",",
          "\n\t\t- "
        )}`;
        const linksForDisplay = `- Links:\n\t\t- ${credit.urls.replaceAll(
          ",",
          "\n\t\t- "
        )}`;
        const notesForDisplay = `- Note: ${credit.notes}`;
        let creditEntry = `${credit.fileName}\n\t${notesForDisplay}\n\t${licensesForDisplay}\n\t${authorsForDisplay}\n\t${linksForDisplay}\n\n`;
        creditString += creditEntry;
      }
    });
    return creditString;
  }

  function previewFile() {
    var file = document.querySelector("input[type=file]").files[0];
    var img = new Image();
    img.onload = function () {
      images["uploaded"] = img;
      redraw();
      showOrHideElements();
    };
    img.src = URL.createObjectURL(file);
  }

  function renameImageDownload(link, canvasItem, filename) {
    link.href = canvasItem.toDataURL();
    link.download = filename;
  }

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

  $("[name=animation]").click(function () {
    showOrHideElements();
  });

  function getSelectedAnimations() {
    const $anims = $("[name=animation]:checked");
    if ($anims.length > 0) {
      return $anims.map(function () {
        return this.id.replace("animation-", "");
      });
    }
    return [];
  }

  $(".licenseCheckBox").click(function () {
    showOrHideElements();
  });

  function getAllowedLicenses() {
    return $(".licenseCheckBox:checkbox:checked")
      .map(function () {
        return $(this).val().split(",");
      })
      .get()
      .map((license) => license.trim());
  }

  function redraw() {
    itemsToDraw = [];
    const bodyTypeName = getBodyTypeName();

    sheetCredits = [];
    var baseUrl = window.location.href.split("/").slice(0, -1).join("/"); // get url until last '/'

    itemsMeta = {
      bodyTypeName: bodyTypeName,
      url: window.location.href,
      spritesheets: baseUrl + "/spritesheets/", // <- holds base URL to spritesheets (used to download them)
      version: 1, // <- to track future compatibilty breaking changes
      datetime: new Date().toLocaleString(),
      credits: "",
    };

    zPosition = 0;
    $("input[type=radio]:checked").each(function (index) {
      for (jdx = 1; jdx < 10; jdx++) {
        if ($(this).data(`layer_${jdx}_${bodyTypeName}`)) {
          const zPos = $(this).data(`layer_${jdx}_zpos`);
          const custom_animation = $(this).data(
            `layer_${jdx}_custom_animation`
          );
          const fileName = $(this).data(`layer_${jdx}_${bodyTypeName}`);
          const parentName = $(this).attr(`name`);
          const name = $(this).attr(`parentName`);
          const variant = $(this).attr(`variant`);
          const licenses = $(this).data(
            `layer_${jdx}_${bodyTypeName}_licenses`
          );
          const authors = $(this).data(`layer_${jdx}_${bodyTypeName}_authors`);
          const urls = $(this).data(`layer_${jdx}_${bodyTypeName}_urls`);
          const notes = $(this).data(`layer_${jdx}_${bodyTypeName}_notes`);

          if (fileName !== "") {
            const supportedAnimations = $(this)
              .closest("[data-animations]")
              .data("animations");
            const itemToDraw = {};
            itemToDraw.fileName = fileName;
            itemToDraw.zPos = zPos;
            itemToDraw.custom_animation = custom_animation;
            itemToDraw.parentName = parentName;
            itemToDraw.name = name;
            itemToDraw.variant = variant;
            itemToDraw.supportedAnimations = supportedAnimations;
            addCreditFor(fileName, licenses, authors, urls, notes);
            itemsToDraw.push(itemToDraw);
          }
        } else {
          break;
        }
      }
    });
    loadItemsToDraw();
    const creditsTxt = sheetCreditsToTxt();
    $("textarea#creditsText").val(creditsTxt);
    itemsMeta["credits"] = sheetCredits;

    if (images["uploaded"] != null) {
      const itemToDraw = {};
      itemToDraw.fileName = "uploaded";
      itemToDraw.zPos = parseInt(document.getElementById("ZPOS").value) || 0;
      itemsToDraw.push(itemToDraw);
    }
  }

  function resetLoading() {
    imagesLoaded = 0;
    imagesToLoad = 0;
    didStartRenderAfterLoad = false;
  }

  function loadItemsToDraw() {
    if (!canRender()) {
      return setTimeout(loadItemsToDraw, 100);
    }
    resetLoading();
    var itemIdx = 0;
    for (item in itemsToDraw) {
      const supportedAnimations = itemsToDraw[itemIdx].supportedAnimations;
      const filePath = itemsToDraw[itemIdx].fileName;
      const custom_animation = itemsToDraw[itemIdx].custom_animation;
      if (custom_animation !== undefined) {
        loadImage(filePath, true);
      } else {
        const { directory, file } = splitFilePath(filePath);

        for (const [key, value] of Object.entries(base_animations)) {
          var animationToCheck = key;
          if (key === "combat_idle") {
            animationToCheck = "combat";
          } else if (key === "backslash") {
            animationToCheck = "1h_slash";
          } else if (key === "halfslash") {
            animationToCheck = "1h_halfslash";
          }
          if (supportedAnimations.includes(animationToCheck)) {
            const newFile = `${directory}/${key}/${file}`;
            loadImage(newFile, true);
          } else {
            // Enable this to see missing animations in the console
            if (DEBUG)
              console.warn(
                `supportedAnimations does not contain ${key} for asset ${file}. skipping render`
              );
          }
        }
      }
      itemIdx += 1;
    }
  }

  function drawItemsToDraw() {
    if (!canRender()) {
      return;
    }
    if (DEBUG) console.log(`Start drawItemsToDraw`);
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
        const customAnimationWidth =
          customAnimation.frameSize * customAnimation.frames[0].length;
        const customAnimationHeight =
          customAnimation.frameSize * customAnimation.frames.length;
        requiredCanvasWidth = Math.max(
          requiredCanvasWidth,
          customAnimationWidth
        );
        requiredCanvasHeight = requiredCanvasHeight + customAnimationHeight;
      }
    }
    canvas.width = requiredCanvasWidth;
    canvas.height = requiredCanvasHeight;

    $("#chooser").css("height", canvas.height);

    var itemIdx = 0;
    var didPutUniversalForCustomAnimation = "";
    itemsToDraw.sort(function (lhs, rhs) {
      return parseInt(lhs.zPos) - parseInt(rhs.zPos);
    });
    for (item in itemsToDraw) {
      const supportedAnimations = itemsToDraw[itemIdx].supportedAnimations;
      const filePath = itemsToDraw[itemIdx].fileName;
      const custom_animation = itemsToDraw[itemIdx].custom_animation;

      if (custom_animation !== undefined) {
        const img = loadImage(filePath, false);
        const customAnimationDefinition = customAnimations[custom_animation];
        const frameSize = customAnimationDefinition.frameSize;

        const customAnimationCanvas = document.createElement("canvas");
        customAnimationCanvas.width = requiredCanvasWidth;
        customAnimationCanvas.height =
          requiredCanvasHeight - universalSheetHeight;
        const customAnimationContext = customAnimationCanvas.getContext("2d");

        const indexInArray = addedCustomAnimations.indexOf(custom_animation);
        var offSetInAdditionToOtherCustomActions = 0;
        for (var i = 0; i < indexInArray; ++i) {
          const otherCustomAction = customAnimations[addedCustomAnimations[i]];
          offSetInAdditionToOtherCustomActions +=
            otherCustomAction.frameSize * otherCustomAction.frames.length;
        }

        if (didPutUniversalForCustomAnimation !== custom_animation) {
          for (var i = 0; i < customAnimationDefinition.frames.length; ++i) {
            const frames = customAnimationDefinition.frames[i];
            for (var j = 0; j < frames.length; ++j) {
              const frameCoordinateX = parseInt(frames[j].split(",")[1]);
              const frameCoordinateRowName = frames[j].split(",")[0];
              const frameCoordinateY =
                animationRowsLayout[frameCoordinateRowName] + 1;
              const offSet = (frameSize - universalFrameSize) / 2;

              var imgDataSingleFrame = ctx.getImageData(
                universalFrameSize * frameCoordinateX,
                universalFrameSize * frameCoordinateY,
                universalFrameSize,
                universalFrameSize
              );
              customAnimationContext.putImageData(
                imgDataSingleFrame,
                frameSize * j + offSet,
                frameSize * i + offSet + offSetInAdditionToOtherCustomActions
              );
            }
          }
          ctx.drawImage(customAnimationCanvas, 0, universalSheetHeight);
          if (itemsToDraw[itemIdx].zPos >= 140) {
            didPutUniversalForCustomAnimation = custom_animation;
          }
        }
        ctx.drawImage(
          img,
          0,
          universalSheetHeight + offSetInAdditionToOtherCustomActions
        );
      } else {
        const splitPath = splitFilePath(filePath);

        for (const [key, value] of Object.entries(base_animations)) {
          var animationToCheck = key;
          if (key === "combat_idle") {
            animationToCheck = "combat";
          } else if (key === "backslash") {
            animationToCheck = "1h_slash";
          } else if (key === "halfslash") {
            animationToCheck = "1h_halfslash";
          }
          if (supportedAnimations.includes(animationToCheck)) {
            const newFile = `${splitPath.directory}/${key}/${splitPath.file}`;
            const img = loadImage(newFile, false);
            drawImage(ctx, img, value);
          } else {
            // Enable this to see missing animations in the console
            // console.warn(`supportedAnimations does not contain ${key} for asset ${file}. skipping render`)
          }
        }
      }
      itemIdx += 1;
    }
    addCustomAnimationPreviews();
  }

  function canRender() {
    if (imagesLoaded >= imagesToLoad) {
      if (DEBUG)
        console.log(`Loaded all ${imagesToLoad} of ${imagesToLoad} assets`);
      return true;
    } else {
      if (DEBUG)
        console.log(
          `Loading... Loaded ${imagesLoaded} of ${imagesToLoad} assets`
        );
      return false;
    }
  }

  function showOrHideElements() {
    const bodyType = getBodyTypeName();
    const selectedAnims = getSelectedAnimations();
    const allowedLicenses = getAllowedLicenses();
    let hasUnsupported = false;
    let hasProhibited = false;

    $("li").each(function (index) {
      // Toggle Required Body Type
      var display = true;
      if ($(this).data("required")) {
        var requiredTypes = $(this).data("required").split(",");
        if (!requiredTypes.includes(bodyType)) {
          display = false;
        }
      }

      if (display) {
        // Toggle Required Animations
        if ($(this).data("animations") && selectedAnims.length > 0) {
          const requiredAnimations = $(this).data("animations").split(",");
          for (const selectedAnim of selectedAnims) {
            if (!requiredAnimations.includes(selectedAnim)) {
              display = false;
              if (
                $(this).find("input[type=radio]:checked:not([id*=none])")
                  .length > 0
              ) {
                hasUnsupported = true;
              }
              break;
            }
          }
        }
      }

      // Display Result
      if (display) {
        $(this).show();
      } else {
        $(this).hide();
      }
    });

    $("input[type=radio]").each(function () {
      var display = true;

      // Toggle allowed licenses
      const licenses = $(this).data(`layer_1_${getBodyTypeName()}_licenses`);
      if (licenses !== undefined) {
        const licensesForAsset = licenses.split(",");
        if (
          !allowedLicenses.some((allowedLicense) =>
            licensesForAsset.includes(allowedLicense)
          )
        ) {
          display = false;
          if ($(this).prop("checked")) {
            hasProhibited = true;
          }
        }
      }

      // Display Result
      if (display) {
        $(this).parent().show();
      } else {
        $(this).parent().hide();
      }
    });

    if (hasUnsupported) {
      $(".removeUnsupported").show();
    } else {
      $(".removeUnsupported").hide();
    }

    if (hasProhibited) {
      $(".removeIncompatibleWithLicenses").show();
    } else {
      $(".removeIncompatibleWithLicenses").hide();
    }
  }

  function interpretParams() {
    $("input[type=radio]").each(function () {
      var words = _.words($(this).attr("id"), "-");
      var initial = _.initial(words).join("-");
      $(this).prop(
        "checked",
        $(this).attr("checked") || params[initial] == _.last(words)
      );
    });
  }

  function setParams() {
    $("input[type=radio]:checked").each(function () {
      var words = _.words($(this).attr("id"), "-");
      var initial = _.initial(words).join("-");
      if (!$(this).attr("checked") || params[initial]) {
        params[initial] = _.last(words);
      }
    });
    jHash.val(params);
  }

  function setParamsFromImport(spritesheet) {
    spritesheet.forEach((sprite) => {
      var name = sprite.name;
      var parentName = sprite.parentName;
      var variant = sprite.variant;
      const assetType = name.replaceAll(" ", "_");
      const assetVariant = variant.replaceAll(" ", "_");
      const assetToSelect = parentName + "-" + assetType + "_" + assetVariant;
      $(`#${assetToSelect}`).prop("checked", true);
    });
    setParams();
  }

  function loadImage(imgRef, allowLoading) {
    if (!allowLoading) {
      return images[imgRef];
    }
    imagesToLoad += 1;
    if (images[imgRef]) {
      setTimeout(function () {
        imageLoadDone();
      }, 10);
      return images[imgRef];
    } else {
      if (DEBUG) console.log(`loading new image ${imgRef}`);
      var img = new Image();
      img.src = "spritesheets/" + imgRef;
      img.onload = imageLoadDone;
      img.onerror = imageLoadError;
      images[imgRef] = img;
      return img;
    }
  }

  function imageLoadDone() {
    imagesLoaded += 1;
    if (!didStartRenderAfterLoad && canRender()) {
      didStartRenderAfterLoad = true;
      drawItemsToDraw();
    }
  }

  function imageLoadError(event) {
    if (DEBUG)
      console.error("There was an error loading image:", event.target.src);
    imageLoadDone();
  }

  async function getImage2(imgRef, callback, layers, prevctx) {
    if (imgRef && images[imgRef] && images[imgRef].complete) {
      callback(layers, prevctx);
      return images[imgRef];
    } else if (imgRef && images[imgRef]) {
      images[imgRef].addEventListener('load', function () {
        callback(layers, prevctx);
      });
      return images[imgRef];
    } else {
      let img = new Image();
      img.src = "spritesheets/" + imgRef;
      images[imgRef] = img;
      await new Promise((resolve) => {
        img.addEventListener('load', function () {
          callback(layers, prevctx);
          setTimeout(resolve, 4);
        });
        img.addEventListener('error', () => setTimeout(resolve, 50));
      });
      return img;
    }
  }

  function drawImage(ctx, img, dy) {
    try {
      ctx.drawImage(img, 0, dy);
      zPosition++;
    } catch (err) {
      if (DEBUG) console.error("Error: could not find " + img.src);
    }
  }

  async function drawPreviews() {
    const buttons = $(this).find("input[type=radio]")
      .filter(function () {
        return $(this).is(":visible");
      })
      .toArray();
    for (const button of buttons) {
      const $this = $(button);
      if (
        !$this.parent().hasClass("hasPreview") &&
        !$this.parent().hasClass("noPreview")
      ) {
        const prev = document.createElement("canvas");
        prev.setAttribute("width", universalFrameSize);
        prev.setAttribute("height", universalFrameSize);
        const prevctx = prev.getContext("2d");
        let img = null;
        const previewRow = parseInt($this.data("preview_row"));
        const previewColumn = parseInt($this.data("preview_column"));
        const previewXOffset = parseInt($this.data("preview_x_offset"));
        const previewYOffset = parseInt($this.data("preview_y_offset"));
        const callback = async function (layers, prevctx) {
          for (index = 0; index < layers.length; index++) {
            if (!images[layers[index].link]) {
              return;
            }
          }
          try {
            const drawLayer = async (layer) => {
              if (layer && layer.link) {
                try {
                  const drawThisPreview = () => {
                    prevctx.drawImage(
                      images[layer.link],
                      previewColumn * universalFrameSize + previewXOffset,
                      previewRow * universalFrameSize + previewYOffset,
                      universalFrameSize,
                      universalFrameSize,
                      0,
                      0,
                      universalFrameSize,
                      universalFrameSize
                    );
                  };
                  if (images[layer.link].complete) {
                    drawThisPreview();
                  } else {
                    images[layer.link].addEventListener('load', drawThisPreview);
                  }
                } catch(e) {
                  if (DEBUG)
                    console.error(e);
                }
              } else if (DEBUG) {
                console.error(`Preview link missing for ${$this.id}`);
              }
            };
            for (const layer of layers) {
              await drawLayer(layer);
            }
          } catch (err) {
            if (DEBUG) console.error(err);
          }
        };

        const layers = [];
        const animation = $this.data(`layer_1_custom_animation`);
        const supportedAnimations = $this
          .closest("[data-animations]")
          .data("animations")
          .split(',');
        let defaultAnimation = 'walk';
        if (supportedAnimations && supportedAnimations.length && !supportedAnimations.includes('walk')) {
          defaultAnimation = supportedAnimations[0];
        }
        const bodyTypeName = getBodyTypeName();
        let imageLink = $this.data(`layer_1_${bodyTypeName}`);

        for (jdx = 1; jdx < 10; jdx++) {
          imageLink = $this.data(`layer_${jdx}_${bodyTypeName}`);
          if (imageLink) {
            if (animation === $this.data(`layer_${jdx}_custom_animation`)) {
              const previewToDraw = {};
              previewToDraw.link = updatePreviewLink(imageLink, animation, defaultAnimation);
              previewToDraw.zPos = $this.data(`layer_${jdx}_zpos`);
              layers.push(previewToDraw);
            }
          } else {
            break;
          }
        }

        layers.sort(function (lhs, rhs) {
          return parseInt(lhs.zPos) - parseInt(rhs.zPos);
        });

        for (const layer of layers) {
          img = await getImage2(layer.link, callback, layers, prevctx);
        }

        if (img && !$(button).parent().hasClass("hasPreview")) {
          button.parentNode.insertBefore(prev, button);
          $(button)
            .parent()
            .addClass("hasPreview")
            .parent()
            .addClass("hasPreview");
        }

        await setTimeout(() => Promise.resolve(), 4);
      }
    }
  }

  function nextFrame() {
    const fpsInterval = 1000 / 8;
    let now = Date.now();
    let elapsed = now - past;
    if (elapsed > fpsInterval) {
      past = now - (elapsed % fpsInterval);

      animCtx.clearRect(0, 0, anim.width, anim.height);
      currentAnimationItemIndex =
        (currentAnimationItemIndex + 1) % animationItems.length;
      const currentFrame = animationItems[currentAnimationItemIndex];
      let frameSize = universalFrameSize;
      let offSet = 0;
      if (activeCustomAnimation !== "") {
        const customAnimation = customAnimations[activeCustomAnimation];
        frameSize = customAnimation.frameSize;
        const indexInArray = addedCustomAnimations.indexOf(activeCustomAnimation);
        offSet = universalSheetHeight;
        for (let i = 0; i < indexInArray; ++i) {
          const otherCustomAction = customAnimations[addedCustomAnimations[i]];
          offSet += otherCustomAction.frameSize * otherCustomAction.frames.length;
        }
      }
      for (let i = 0; i < animRowNum; ++i) {
        animCtx.drawImage(
          canvas,
          currentFrame * frameSize,
          offSet + (animRowStart + i) * frameSize,
          frameSize,
          frameSize,
          i * frameSize,
          0,
          frameSize,
          frameSize
        );
      }
    }
    requestAnimationFrame(nextFrame);
  }

  function updatePreviewLink(imageLink, customWalkAnimation, defaultAnimation) {
    const { directory, file } = splitFilePath(imageLink);
    if (customWalkAnimation) {
      imageLink = `${directory}/${file}`;
    } else if (defaultAnimation) {
      imageLink = `${directory}/${defaultAnimation}/${file}`;
    } else {
      imageLink = `${directory}/walk/${file}`;
    }
    if (DEBUG) console.log('preview image:', imageLink);
    return imageLink;
  }

  function splitFilePath(filePath) {
    const index = filePath.lastIndexOf("/");
    if (index > -1) {
      return {
        directory: filePath.substring(0, index),
        file: filePath.substring(index + 1),
      };
    } else {
      throw new Error(
        `Could not split to directory and file using path ${filePath}`
      );
    }
  }
});
