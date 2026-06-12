# Complete Simplified Chinese Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成本项目简体中文汉化闭环，修复动态资源名、变体名、调色板弹窗、选择标签、搜索和 tooltip 中仍然回退英文或破坏状态兼容的问题。

**Architecture:** 保持元数据和 URL hash 仍使用原始英文稳定值，只在渲染层通过集中 i18n helper 转换为中文显示。`lang/i18n.ts` 负责所有显示名规范化、组合和 fallback；组件只调用 helper，不再自行拼接可见英文文本。

**Tech Stack:** Mithril.js、TypeScript、Node test runner、Mocha/Chai/Testem、JSON 翻译资源、现有 `lang/i18n.ts` 轻量 i18n 系统。

---

## 当前问题摘要

1. `ItemWithRecolors` / `ItemWithVariants` 已把 `meta.name` 翻译成中文后再判断 `displayName === "Body Color"`，中文环境下会导致身体颜色节点展开 key 失效。
2. 调色板弹窗仍直接显示 `opt.label`、`paletteVersionMeta.label`、`materialMeta.label`、`palette` 原始英文。
3. 物品变体仍直接显示 `variant.replaceAll("_", " ")` 后的英文或英文组合。
4. `state.selections[*].name` 混入了部分中文显示名，可能破坏 `getHashParamsforSelections()` 依赖英文原始名生成 URL hash 的兼容性。
5. 当前选择标签只用完整字符串查 `item.*`，组合变体名大多没有完整 key，会回退英文。
6. 搜索只匹配英文元数据名，中文名称搜索体验不完整。
7. tooltip 中动画列表直接显示 `walk/slash/idle` 等原始值。

## 文件结构

- Modify: `lang/i18n.ts`
  - 新增动态显示名 helper：变体、调色板颜色、重着色 label、调色板材质/版本、选择标签、动画列表。
  - 保持 hash/状态仍使用原始英文值；helper 只返回显示文本。
- Modify: `lang/zh.json`
  - 新增 `recolor.*`、`paletteMaterial.*`、`paletteVersion.*`、`variant.*`、`variantToken.*` 翻译。
- Modify: `lang/en.json`
  - 增加与 `zh.json` 完全一致的 key，值为英文显示文本。
- Modify: `sources/components/tree/ItemWithRecolors.ts`
  - 修复身体颜色展开 key 判断。
  - 渲染重着色 label 时调用 i18n helper。
- Modify: `sources/components/tree/ItemWithVariants.ts`
  - 修复身体颜色展开 key 判断。
  - 渲染变体名时调用 i18n helper。
- Modify: `sources/components/tree/PaletteSelectModal.ts`
  - 弹窗标题、版本/材质标题、颜色名全部调用 i18n helper。
- Modify: `sources/components/tree/TreeNode.ts`
  - 简单物品选择时向 `state.selections` 保存原始 `meta.name`，不要保存中文显示名。
  - 搜索同时匹配英文原始名和中文显示名。
  - tooltip 动画名调用 `getAnimationDisplayName()`。
- Modify: `sources/components/selections/CurrentSelections.ts`
  - 当前选择标签使用 `getSelectionDisplayName(selection.name)`。
  - tooltip 动画名调用 `getAnimationDisplayName()`。
- Modify: `sources/utils/helpers.ts`
  - 搜索 helper 支持可选额外显示名，或新增局部 helper 避免重复。
- Test: `tests/node/state/i18n_spec.js`
  - 覆盖动态显示名 helper 和生成元数据覆盖率。
- Test: `tests/components/tree/ItemWithRecolors_spec.js`
  - 覆盖重着色 label 中文显示和身体颜色展开 key。
- Test: `tests/components/tree/ItemWithVariants_spec.js`
  - 覆盖变体名中文显示和身体颜色展开 key。
- Test: `tests/components/tree/PaletteSelectModal_spec.js`
  - 覆盖弹窗标题、版本/材质、颜色名中文显示。
- Test: `tests/components/tree/TreeNode_spec.js`
  - 覆盖中文搜索、原始 selection name 保存、tooltip 动画中文。
- Test: `tests/components/selections/CurrentSelections_spec.js`
  - 覆盖选择标签组合中文显示和 tooltip 动画中文。

---

### Task 1: 添加动态显示名 i18n 失败测试

**Files:**

- Modify: `tests/node/state/i18n_spec.js`

- [ ] **Step 1: 扩展 import**

把现有 import 改成包含新 helper。测试先写，当前生产代码没有这些导出，运行时应失败。

```js
import {
  getCategoryDisplayName,
  getItemDisplayName,
  getPaletteColorDisplayName,
  getPaletteMaterialDisplayName,
  getPaletteVersionDisplayName,
  getRecolorLabelDisplayName,
  getSelectionDisplayName,
  getVariantDisplayName,
  loadTranslations,
  setLanguage,
} from "../../../lang/i18n.ts";
```

- [ ] **Step 2: 添加 helper 行为测试**

追加以下测试：

```js
test("dynamic display helpers localize recolor labels, palette labels, and variants", () => {
  loadTranslations("test-dynamic-display", {
    "recolor.Eye Color": "眼睛颜色",
    "paletteMaterial.Skintone": "肤色",
    "paletteVersion.Universal LPC": "通用 LPC",
    "variant.light": "浅色",
    "variant.bluegray": "蓝灰色",
    "variantToken.kite": "风筝盾",
    "variantToken.blue": "蓝色",
    "variantToken.gray": "灰色",
  });
  setLanguage("test-dynamic-display");

  assert.equal(getRecolorLabelDisplayName("Eye Color"), "眼睛颜色");
  assert.equal(getPaletteMaterialDisplayName("Skintone"), "肤色");
  assert.equal(getPaletteVersionDisplayName("Universal LPC"), "通用 LPC");
  assert.equal(getVariantDisplayName("light"), "浅色");
  assert.equal(getPaletteColorDisplayName("bluegray"), "蓝灰色");
  assert.equal(getVariantDisplayName("kite blue gray"), "风筝盾蓝色灰色");
});

test("selection display names localize base item and variant parts without changing stored raw names", () => {
  loadTranslations("test-selection-display", {
    "item.Body Color": "身体颜色",
    "item.Human Male": "人类男性",
    "recolor.Eye Color": "眼睛颜色",
    "variant.light": "浅色",
    "variant.bluegray": "蓝灰色",
  });
  setLanguage("test-selection-display");

  assert.equal(
    getSelectionDisplayName("Body Color (light)"),
    "身体颜色（浅色）",
  );
  assert.equal(
    getSelectionDisplayName("Human Male (light | bluegray)"),
    "人类男性（浅色 | 蓝灰色）",
  );
  assert.equal(
    getSelectionDisplayName("Eye Color (bluegray)"),
    "眼睛颜色（蓝灰色）",
  );
});
```

- [ ] **Step 3: 添加生成元数据覆盖测试**

追加以下测试，确保所有当前可见重着色 label 和变体值都有可本地化路径：

```js
test("all generated recolor labels and item variants have Chinese display names", () => {
  const zhTranslations = JSON.parse(fs.readFileSync("lang/zh.json", "utf8"));
  loadTranslations("test-dynamic-coverage", zhTranslations);
  setLanguage("test-dynamic-coverage");
  const { itemMetadata } = generateSources({
    writeCredits: false,
    writeMetadata: false,
  }) ?? await import("../../../scripts/generateSources/state.js");

  const stateModule = await import("../../../scripts/generateSources/state.js");
  const missingRecolorLabels = new Set();
  const missingVariants = new Set();

  for (const meta of Object.values(stateModule.itemMetadata)) {
    for (const recolor of meta.recolors ?? []) {
      if (recolor.label && getRecolorLabelDisplayName(recolor.label) === recolor.label) {
        missingRecolorLabels.add(recolor.label);
      }
    }
    for (const variant of meta.variants ?? []) {
      const fallback = variant.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
      if (getVariantDisplayName(variant) === fallback) {
        missingVariants.add(variant);
      }
    }
  }

  assert.deepEqual([...missingRecolorLabels].sort(), []);
  assert.deepEqual([...missingVariants].sort(), []);
});
```

如果 Node 不支持在非 async test 中 `await import`，将该测试声明改成：

```js
test("all generated recolor labels and item variants have Chinese display names", async () => {
  // same body
});
```

- [ ] **Step 4: 运行失败测试**

Run: `npm run test:node -- --test-name-pattern "dynamic display|selection display|generated recolor"`

Expected: FAIL，原因是 `getPaletteColorDisplayName` 等新 helper 还未从 `lang/i18n.ts` 导出。

---

### Task 2: 实现集中动态显示名 helper

**Files:**

- Modify: `lang/i18n.ts`

- [ ] **Step 1: 写最小实现**

在 `normalizeTranslationKeySegment()` 后添加以下函数，并导出所有新 helper。

```ts
function formatFallbackDisplayName(value: string): string {
  return value
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function translateWithNormalizedKey(
  prefix: string,
  value: string,
): string | null {
  const rawKey = `${prefix}.${value}`;
  const rawTranslated = t(rawKey);
  if (rawTranslated !== rawKey) return rawTranslated;

  const normalizedKey = `${prefix}.${normalizeTranslationKeySegment(value)}`;
  const normalizedTranslated = t(normalizedKey);
  return normalizedTranslated === normalizedKey ? null : normalizedTranslated;
}

function translateVariantByTokens(value: string): string | null {
  const normalized = value.replaceAll("_", " ").trim();
  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length <= 1) return null;

  const translatedTokens = tokens.map((token) => {
    const translated = translateWithNormalizedKey("variantToken", token);
    return translated ?? token;
  });

  return translatedTokens.some((part, index) => part !== tokens[index])
    ? translatedTokens.join("")
    : null;
}

export function getVariantDisplayName(
  value: string | null | undefined,
): string {
  if (!value) return "";
  const direct = translateWithNormalizedKey("variant", value);
  if (direct) return direct;
  const tokenized = translateVariantByTokens(value);
  if (tokenized) return tokenized;
  return formatFallbackDisplayName(value);
}

export function getPaletteColorDisplayName(
  value: string | null | undefined,
): string {
  if (!value) return "";
  const parts = value.split(".");
  const colorName = parts[parts.length - 1] ?? value;
  return getVariantDisplayName(colorName);
}

export function getRecolorLabelDisplayName(
  label: string | null | undefined,
): string {
  if (!label) return "";
  return (
    translateWithNormalizedKey("recolor", label) ?? getItemDisplayName(label)
  );
}

export function getPaletteMaterialDisplayName(
  label: string | null | undefined,
): string {
  if (!label) return "";
  return (
    translateWithNormalizedKey("paletteMaterial", label) ??
    getRecolorLabelDisplayName(label)
  );
}

export function getPaletteVersionDisplayName(
  label: string | null | undefined,
): string {
  if (!label) return "";
  return translateWithNormalizedKey("paletteVersion", label) ?? label;
}

export function getSelectionDisplayName(name: string): string {
  const match = /^(.*?) \((.*)\)$/.exec(name);
  if (!match) return getItemDisplayName(name);

  const [, baseName, details] = match;
  const baseDisplay =
    getRecolorLabelDisplayName(baseName) || getItemDisplayName(baseName);
  const detailDisplay = details
    .split(" | ")
    .map((part) => getPaletteColorDisplayName(part.trim()))
    .join(" | ");
  return `${baseDisplay}（${detailDisplay}）`;
}

export function getAnimationListDisplayName(values: readonly string[]): string {
  return values.map((value) => getAnimationDisplayName(value)).join(", ");
}
```

- [ ] **Step 2: 修正覆盖测试中的生成元数据读取**

如果 Task 1 中测试用了错误的 `generateSources()` 返回值，改为顶层 import：

```js
import { itemMetadata } from "../../../scripts/generateSources/state.js";
```

然后测试内只调用：

```js
generateSources({ writeCredits: false, writeMetadata: false });
for (const meta of Object.values(itemMetadata)) {
  // assertions
}
```

- [ ] **Step 3: 运行测试确认 helper 行为仍因缺翻译失败**

Run: `npm run test:node -- --test-name-pattern "dynamic display|selection display|generated recolor"`

Expected: 至少 helper 导入错误消失；覆盖测试仍可能 FAIL，列出缺失 `variant.*` / `variantToken.*` / `recolor.*` key。

---

### Task 3: 补齐动态翻译资源

**Files:**

- Modify: `lang/zh.json`
- Modify: `lang/en.json`

- [ ] **Step 1: 添加重着色和调色板 label key**

在两份 JSON 中添加同样 key。中文值如下：

```json
{
  "recolor.Cloth": "布料",
  "recolor.Eye Color": "眼睛颜色",
  "recolor.Hair": "头发",
  "recolor.Hair Band": "发带",
  "recolor.Hair Tie": "发带",
  "recolor.Helmet Strands": "头盔束带",
  "recolor.Kettle Inner": "锅盔内衬",
  "recolor.Leather Armor Belt": "皮甲腰带",
  "recolor.Legion Pattern": "军团图案",
  "recolor.Metal": "金属",
  "recolor.Skintone": "肤色",
  "paletteMaterial.Cloth": "布料",
  "paletteMaterial.Hair": "头发",
  "paletteMaterial.Metal": "金属",
  "paletteMaterial.Skintone": "肤色",
  "paletteVersion.Universal LPC": "通用 LPC",
  "paletteVersion.LPC Revised": "LPC 修订版"
}
```

英文值使用原文：`"Cloth"`、`"Eye Color"`、`"Universal LPC"` 等。

- [ ] **Step 2: 添加常用完整 variant key**

优先添加完整 key，避免高频组合靠 token 拼得不自然。两份 JSON key 一致，英文值为标题化英文，中文值如下：

```json
{
  "variant.light": "浅色",
  "variant.dark": "深色",
  "variant.medium": "中等",
  "variant.black": "黑色",
  "variant.white": "白色",
  "variant.gray": "灰色",
  "variant.grey": "灰色",
  "variant.red": "红色",
  "variant.green": "绿色",
  "variant.blue": "蓝色",
  "variant.yellow": "黄色",
  "variant.orange": "橙色",
  "variant.purple": "紫色",
  "variant.pink": "粉色",
  "variant.brown": "棕色",
  "variant.blonde": "金发",
  "variant.bluegray": "蓝灰色",
  "variant.light brown": "浅棕色",
  "variant.dark brown": "深棕色",
  "variant.light gray": "浅灰色",
  "variant.dark gray": "深灰色",
  "variant.forest green": "森林绿",
  "variant.brown striped": "棕色条纹",
  "variant.gray striped": "灰色条纹",
  "variant.green striped": "绿色条纹",
  "variant.base_black": "基础黑色",
  "variant.base_brown": "基础棕色",
  "variant.base_gray": "基础灰色",
  "variant.base_maroon": "基础栗色",
  "variant.base_red": "基础红色",
  "variant.base_teal": "基础蓝绿色",
  "variant.base_yellow": "基础黄色",
  "variant.peg_leg": "木腿",
  "variant.longsword_alt": "长剑替代版",
  "variant.two_engrailed": "双凹缘盾",
  "variant.two_engrailed_trim": "双凹缘盾边饰",
  "variant.scutum_trim": "罗马盾边饰"
}
```

- [ ] **Step 3: 添加 variant token key**

添加以下 token key，用于组合翻译未显式列出的变体。英文值使用首字母大写原文，中文值如下：

```json
{
  "variantToken.3": "3",
  "variantToken.9": "9",
  "variantToken.aegean": "爱琴蓝",
  "variantToken.alt": "替代版",
  "variantToken.amber": "琥珀色",
  "variantToken.amethyst": "紫水晶色",
  "variantToken.apple": "苹果色",
  "variantToken.apricot": "杏色",
  "variantToken.arrow": "箭",
  "variantToken.ash": "灰烬色",
  "variantToken.axe": "斧",
  "variantToken.azure": "天蓝色",
  "variantToken.base": "基础",
  "variantToken.beige": "米色",
  "variantToken.black": "黑色",
  "variantToken.blonde": "金色",
  "variantToken.blue": "蓝色",
  "variantToken.bluegray": "蓝灰色",
  "variantToken.boomerang": "回旋镖",
  "variantToken.brass": "黄铜",
  "variantToken.bright": "亮",
  "variantToken.bronze": "青铜",
  "variantToken.brown": "棕色",
  "variantToken.cane": "手杖",
  "variantToken.carrot": "胡萝卜色",
  "variantToken.ceramic": "陶瓷",
  "variantToken.cerise": "樱桃红",
  "variantToken.cerulean": "蔚蓝色",
  "variantToken.charcoal": "炭灰色",
  "variantToken.chestnut": "栗色",
  "variantToken.chocolate": "巧克力色",
  "variantToken.club": "棍棒",
  "variantToken.coal": "煤黑色",
  "variantToken.coffee": "咖啡色",
  "variantToken.copper": "铜",
  "variantToken.coral": "珊瑚色",
  "variantToken.cornflower": "矢车菊蓝",
  "variantToken.crossbow": "弩",
  "variantToken.crown": "王冠",
  "variantToken.crusader": "十字军",
  "variantToken.cyan": "青色",
  "variantToken.cyclops": "独眼",
  "variantToken.dagger": "匕首",
  "variantToken.dark": "深",
  "variantToken.darkblue": "深蓝色",
  "variantToken.denim": "牛仔蓝",
  "variantToken.dove": "鸽灰色",
  "variantToken.dragonfly": "蜻蜓",
  "variantToken.emerald": "祖母绿色",
  "variantToken.engrailed": "凹缘",
  "variantToken.fern": "蕨绿色",
  "variantToken.flail": "链枷",
  "variantToken.forest": "森林",
  "variantToken.fur": "毛皮",
  "variantToken.garnet": "石榴红",
  "variantToken.ginger": "姜黄色",
  "variantToken.gold": "金色",
  "variantToken.gray": "灰色",
  "variantToken.green": "绿色",
  "variantToken.halberd": "戟",
  "variantToken.hammer": "锤",
  "variantToken.heather": "石南紫",
  "variantToken.hoe": "锄头",
  "variantToken.honey": "蜂蜜色",
  "variantToken.hook": "钩",
  "variantToken.horns": "角",
  "variantToken.ice": "冰蓝色",
  "variantToken.indigo": "靛蓝色",
  "variantToken.iron": "铁",
  "variantToken.ivory": "象牙色",
  "variantToken.jack": "杰克",
  "variantToken.katana": "武士刀",
  "variantToken.kite": "风筝盾",
  "variantToken.lavender": "薰衣草色",
  "variantToken.leather": "皮革",
  "variantToken.leg": "腿",
  "variantToken.lemon": "柠檬黄",
  "variantToken.light": "浅",
  "variantToken.lightblue": "浅蓝色",
  "variantToken.linen": "亚麻色",
  "variantToken.logs": "木段",
  "variantToken.longsword": "长剑",
  "variantToken.lunar": "月光",
  "variantToken.mace": "狼牙棒",
  "variantToken.maroon": "栗色",
  "variantToken.mauve": "淡紫色",
  "variantToken.medium": "中等",
  "variantToken.metallic": "金属质感",
  "variantToken.midnight": "午夜蓝",
  "variantToken.mint": "薄荷色",
  "variantToken.monarch": "帝王蝶",
  "variantToken.mustard": "芥末黄",
  "variantToken.navy": "海军蓝",
  "variantToken.neptune": "海王蓝",
  "variantToken.oak": "橡木色",
  "variantToken.ochre": "赭色",
  "variantToken.olive": "橄榄色",
  "variantToken.olivine": "橄榄石色",
  "variantToken.orange": "橙色",
  "variantToken.pale": "淡",
  "variantToken.peach": "桃色",
  "variantToken.pearl": "珍珠色",
  "variantToken.peg": "木钉",
  "variantToken.periwinkle": "长春花蓝",
  "variantToken.pickaxe": "镐",
  "variantToken.pink": "粉色",
  "variantToken.pirate": "海盗",
  "variantToken.pixie": "小精灵",
  "variantToken.platinum": "铂金",
  "variantToken.plum": "梅子色",
  "variantToken.plus": "十字",
  "variantToken.porcelain": "瓷白色",
  "variantToken.powder": "粉末蓝",
  "variantToken.purple": "紫色",
  "variantToken.quiver": "箭袋",
  "variantToken.rapier": "刺剑",
  "variantToken.raven": "乌黑色",
  "variantToken.red": "红色",
  "variantToken.redhead": "红发",
  "variantToken.rod": "杖",
  "variantToken.rose": "玫瑰色",
  "variantToken.round": "圆盾",
  "variantToken.royal": "皇家蓝",
  "variantToken.saber": "军刀",
  "variantToken.salmon": "鲑鱼粉",
  "variantToken.sandy": "沙色",
  "variantToken.sara": "萨拉",
  "variantToken.scimitar": "弯刀",
  "variantToken.scutum": "罗马盾",
  "variantToken.scythe": "镰刀",
  "variantToken.sepia": "棕褐色",
  "variantToken.shadow": "阴影",
  "variantToken.shovel": "铲",
  "variantToken.silver": "银色",
  "variantToken.simple": "简易",
  "variantToken.skeleton": "骷髅",
  "variantToken.skin": "皮肤",
  "variantToken.sky": "天空蓝",
  "variantToken.slate": "石板灰",
  "variantToken.slingshot": "弹弓",
  "variantToken.smoke": "烟灰色",
  "variantToken.soot": "煤烟色",
  "variantToken.spartan": "斯巴达",
  "variantToken.spring": "春绿色",
  "variantToken.square": "方盾",
  "variantToken.steel": "钢",
  "variantToken.strawberry": "草莓红",
  "variantToken.striped": "条纹",
  "variantToken.sunglasses": "太阳镜",
  "variantToken.swamp": "沼泽绿",
  "variantToken.tan": "棕褐色",
  "variantToken.taupe": "灰褐色",
  "variantToken.tawny": "黄褐色",
  "variantToken.teal": "蓝绿色",
  "variantToken.tiara": "王冠",
  "variantToken.tin": "锡色",
  "variantToken.trim": "边饰",
  "variantToken.tumeric": "姜黄色",
  "variantToken.two": "双",
  "variantToken.umber": "棕土色",
  "variantToken.violet": "紫罗兰色",
  "variantToken.walnut": "胡桃色",
  "variantToken.wand": "魔杖",
  "variantToken.waraxe": "战斧",
  "variantToken.watering": "浇水壶",
  "variantToken.whip": "鞭",
  "variantToken.white": "白色",
  "variantToken.wine": "酒红色",
  "variantToken.yellow": "黄色",
  "variantToken.zombie": "僵尸"
}
```

- [ ] **Step 4: 英文 JSON 同步规则**

`lang/en.json` 必须拥有完全相同的 key。英文值可以由 key 末尾转换得到，例如：

```json
{
  "variantToken.bluegray": "Bluegray",
  "variantToken.longsword": "Longsword",
  "variantToken.two": "Two"
}
```

对完整 variant key 使用更自然标题化英文，例如 `"variant.light brown": "Light Brown"`。

- [ ] **Step 5: 运行资源覆盖测试**

Run: `npm run test:node -- --test-name-pattern "generated recolor"`

Expected: PASS。

---

### Task 4: 接入树节点、选择状态和搜索汉化

**Files:**

- Modify: `sources/components/tree/TreeNode.ts`
- Modify: `sources/components/selections/CurrentSelections.ts`
- Modify: `sources/utils/helpers.ts`
- Test: `tests/components/tree/TreeNode_spec.js`
- Test: `tests/components/selections/CurrentSelections_spec.js`

- [ ] **Step 1: 写 TreeNode 失败测试**

在 `tests/components/tree/TreeNode_spec.js` 追加：

```js
it("matches Chinese localized item names in search and stores raw names for hash compatibility", function () {
  seedBrowserCatalog({
    tn_body: {
      name: "Body Color",
      type_name: "body",
      required: [...BODY_TYPES],
      animations: ["walk"],
      credits: [],
      layers: {},
      recolors: [],
    },
  });
  state.searchQuery = "身体";
  state.expandedNodes.body = true;

  m.render(
    host,
    m(TreeNode, {
      catalog: defaultCatalog,
      name: "body",
      node: { items: ["tn_body"], children: {} },
    }),
  );

  const itemRow = host.querySelector(".tree-node");
  assert.notEqual(itemRow, null);
  assert.include(itemRow.textContent, "身体颜色");
  itemRow.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  assert.strictEqual(state.selections.body.name, "Body Color");
});

it("localizes animation names in item tooltips", function () {
  seedBrowserCatalog({
    tn_tooltip: {
      name: "Body Color",
      type_name: "body",
      required: [...BODY_TYPES],
      animations: ["walk", "idle"],
      credits: [{ file: "body.png", licenses: ["CC0"] }],
      layers: {},
      recolors: [],
    },
  });
  state.expandedNodes.body = true;

  m.render(
    host,
    m(TreeNode, {
      catalog: defaultCatalog,
      name: "body",
      node: { items: ["tn_tooltip"], children: {} },
    }),
  );

  const itemRow = host.querySelector(".tree-node");
  assert.include(itemRow.getAttribute("title"), "行走");
  assert.include(itemRow.getAttribute("title"), "待机");
});
```

- [ ] **Step 2: 写 CurrentSelections 失败测试**

在 `tests/components/selections/CurrentSelections_spec.js` 追加：

```js
it("renders localized selection display names and localized animation tooltip labels", function () {
  seedBrowserCatalog({
    sel_body_color: {
      name: "Body Color",
      type_name: "body",
      animations: ["walk", "idle"],
      credits: [{ file: "body.png", licenses: ["CC0"] }],
      layers: {},
    },
  });
  state.selections = {
    body: { itemId: "sel_body_color", name: "Body Color (light)" },
  };

  m.render(host, m(CurrentSelections, { catalog: defaultCatalog }));

  const tag = host.querySelector("span.tag.is-medium");
  assert.include(tag.textContent, "身体颜色（浅色）");
  assert.include(tag.getAttribute("title"), "行走");
  assert.include(tag.getAttribute("title"), "待机");
});
```

- [ ] **Step 3: 运行失败测试**

Run: `npm test -- --filter "Chinese localized|localized selection"`

如果 Testem 不支持该过滤参数，运行：`npm test`。

Expected: FAIL，中文搜索、tooltip 或 selection raw name 断言失败。

- [ ] **Step 4: 修改 `TreeNode.ts`**

导入新增 helper：

```ts
import {
  t,
  getAnimationListDisplayName,
  getItemDisplayName,
  getCategoryDisplayName,
} from "../../../lang/i18n.ts";
```

把搜索匹配改为同时匹配原始名和显示名：

```ts
matchesSearch(meta.name, searchQuery) ||
  matchesSearch(getItemDisplayName(meta.name), searchQuery);
```

`renderItemList()` 中也同样改：

```ts
const displayName = getItemDisplayName(lite.name);
if (
  searchQuery &&
  searchQuery.length >= 2 &&
  !matchesSearch(lite.name, searchQuery) &&
  !matchesSearch(displayName, searchQuery)
) {
  return false;
}
```

tooltip 动画名改为：

```ts
const animsText =
  supportedAnims.length > 0
    ? `${t("treeNode.animations")}${getAnimationListDisplayName(supportedAnims)}`
    : t("treeNode.noAnimationInfo");
```

简单物品选择时保存原始名：

```ts
state.selections[selectionGroup] = {
  itemId,
  name: meta.name,
};
```

- [ ] **Step 5: 修改 `helpers.ts` 的 `nodeHasMatches()`**

导入：

```ts
import { getItemDisplayName } from "../../lang/i18n.ts";
```

匹配逻辑改为：

```ts
(meta) =>
  matchesSearch(meta.name, query) ||
  matchesSearch(getItemDisplayName(meta.name), query),
```

- [ ] **Step 6: 修改 `CurrentSelections.ts`**

导入：

```ts
import {
  t,
  getAnimationListDisplayName,
  getSelectionDisplayName,
} from "../../../lang/i18n.ts";
```

tooltip 动画名改为：

```ts
const animsText =
  supportedAnims.length > 0
    ? `${t("currentSelections.animations")}${getAnimationListDisplayName(supportedAnims)}`
    : t("currentSelections.noAnimationInfo");
```

标签文本改为：

```ts
m("span", getSelectionDisplayName(selection.name)),
```

- [ ] **Step 7: 运行测试确认通过**

Run: `npm test`

Expected: PASS。

---

### Task 5: 接入变体和重着色 UI 汉化

**Files:**

- Modify: `sources/components/tree/ItemWithRecolors.ts`
- Modify: `sources/components/tree/ItemWithVariants.ts`
- Test: `tests/components/tree/ItemWithRecolors_spec.js`
- Test: `tests/components/tree/ItemWithVariants_spec.js`

- [ ] **Step 1: 写 ItemWithRecolors 失败测试**

在 `tests/components/tree/ItemWithRecolors_spec.js` 中，把已有 `shows palette swatches and preview row when expanded` 断言从英文改为中文：

```js
assert.ok(host.textContent.includes("布料"));
assert.notInclude(host.textContent, "Cloth");
```

再新增身体颜色展开 key 测试：

```js
it("uses raw item identity rather than localized display name for Body Color expansion key", function () {
  seedBrowserCatalog(
    {
      body: {
        name: "Body Color",
        type_name: "body",
        required: [...BODY_TYPES],
        animations: ["walk"],
        credits: [],
        layers: {},
        matchBodyColor: true,
        recolors: [
          {
            label: "Skintone",
            type_name: null,
            material: "body",
            default: "ulpc",
            base: "ulpc.light",
            palettes: { ulpc: { light: ["#000", "#111"] } },
            variants: ["light"],
          },
        ],
      },
    },
    {
      categoryTree: { items: [], children: {} },
      paletteMetadata: clothPaletteMetadata,
    },
  );
  const meta = getItemMerged("body").unwrapOr(null);

  m.render(host, m(ItemWithRecolors, { ...baseAttrs(meta), itemId: "body" }));

  host
    .querySelector(".tree-label")
    .dispatchEvent(new MouseEvent("click", { bubbles: true }));
  assert.strictEqual(state.expandedNodes["body-body"], true);
});
```

- [ ] **Step 2: 写 ItemWithVariants 失败测试**

在 `tests/components/tree/ItemWithVariants_spec.js` 中新增：

```js
it("renders localized variant display names", function () {
  const meta = seedVariantItem({ variants: ["light", "bluegray"] });
  state.expandedNodes.iv_variant = true;

  m.render(host, m(ItemWithVariants, baseAttrs(meta)));

  assert.include(host.textContent, "浅色");
  assert.include(host.textContent, "蓝灰色");
  assert.notInclude(host.textContent, "Bluegray");
});
```

如果现有 spec 没有 `seedVariantItem()` / `baseAttrs()`，按现有 fixture helper 命名改写，但断言保持一致。

- [ ] **Step 3: 运行失败测试**

Run: `npm test`

Expected: FAIL，仍显示 `Cloth` / `Bluegray` 或身体颜色 key 断言失败。

- [ ] **Step 4: 修改 `ItemWithRecolors.ts`**

导入：

```ts
import {
  t,
  getItemDisplayName,
  getRecolorLabelDisplayName,
} from "../../../lang/i18n.ts";
```

身体颜色 key 判断改为原始值：

```ts
if (itemId === "body" || meta.name === "Body Color") {
  nodePath = "body-body";
}
```

重着色 label 改为：

```ts
m("label", getRecolorLabelDisplayName(opt.label)),
```

- [ ] **Step 5: 修改 `ItemWithVariants.ts`**

导入：

```ts
import {
  getItemDisplayName,
  getVariantDisplayName,
} from "../../../lang/i18n.ts";
```

身体颜色 key 判断改为：

```ts
if (itemId === "body" || meta.name === "Body Color") {
  nodePath = "body-body";
}
```

变体显示名改为：

```ts
const variantDisplayName = getVariantDisplayName(variant);
```

渲染处改为：

```ts
m("span.variant-display-name.has-text-centered.is-size-7", variantDisplayName),
```

- [ ] **Step 6: 运行测试确认通过**

Run: `npm test`

Expected: PASS。

---

### Task 6: 接入调色板弹窗汉化

**Files:**

- Modify: `sources/components/tree/PaletteSelectModal.ts`
- Test: `tests/components/tree/PaletteSelectModal_spec.js`

- [ ] **Step 1: 写失败测试**

在 `tests/components/tree/PaletteSelectModal_spec.js` 新增或修改现有弹窗渲染测试，断言标题、版本、材质、颜色名为中文：

```js
it("localizes modal title, palette version, material, and color labels", function () {
  const meta = seedPaletteModalFixture();
  const opt = {
    idx: 0,
    label: "Eye Color",
    default: "ulpc",
    material: "body",
    type_name: null,
    matchBodyColor: false,
    versions: ["body.ulpc"],
    selectionColor: null,
    colors: null,
  };

  m.render(
    host,
    m(PaletteSelectModal, {
      itemId: "face_neutral",
      opt,
      selectedColors: {},
      compactDisplay: false,
      rootViewNode: { state: {} },
      catalog: defaultCatalog,
      onClose: () => {},
      onSelect: () => {},
    }),
  );

  assert.include(host.textContent, "眼睛颜色");
  assert.include(host.textContent, "通用 LPC");
  assert.include(host.textContent, "肤色");
  assert.include(host.textContent, "浅色");
});
```

如果现有 spec 已有 catalog/palette fixture helper，用现有 helper 替换 `seedPaletteModalFixture()`。关键断言保持中文。

- [ ] **Step 2: 运行失败测试**

Run: `npm test`

Expected: FAIL，弹窗仍显示英文。

- [ ] **Step 3: 修改 `PaletteSelectModal.ts` import**

```ts
import {
  t,
  getPaletteColorDisplayName,
  getPaletteMaterialDisplayName,
  getPaletteVersionDisplayName,
  getRecolorLabelDisplayName,
} from "../../../lang/i18n.ts";
```

- [ ] **Step 4: 本地化弹窗标题**

```ts
m("h4", getRecolorLabelDisplayName(opt.label)),
```

- [ ] **Step 5: 本地化版本/材质标题**

替换 `paletteVersionMeta?.label + ...` 为：

```ts
const versionLabel = getPaletteVersionDisplayName(
  paletteVersionMeta?.label ?? version,
);
const materialLabel = getPaletteMaterialDisplayName(
  materialMeta?.label ?? material,
);
const versionDisplayName =
  material !== opt.material
    ? `${versionLabel} - ${materialLabel}`
    : versionLabel;
```

渲染：

```ts
m("span.palette-version", versionDisplayName),
```

- [ ] **Step 6: 本地化颜色名**

```ts
m(
  "span.variant-display-name.has-text-centered.is-size-7",
  getPaletteColorDisplayName(palette),
),
```

- [ ] **Step 7: 运行测试确认通过**

Run: `npm test`

Expected: PASS。

---

### Task 7: 最终校验和回归审计

**Files:**

- Verify only; no production file changes unless tests reveal问题。

- [ ] **Step 1: 格式化仅本次改动文件**

Run:

```bash
npx prettier --write lang/i18n.ts lang/zh.json lang/en.json tests/node/state/i18n_spec.js tests/components/tree/ItemWithRecolors_spec.js tests/components/tree/ItemWithVariants_spec.js tests/components/tree/PaletteSelectModal_spec.js tests/components/tree/TreeNode_spec.js tests/components/selections/CurrentSelections_spec.js sources/components/tree/ItemWithRecolors.ts sources/components/tree/ItemWithVariants.ts sources/components/tree/PaletteSelectModal.ts sources/components/tree/TreeNode.ts sources/components/selections/CurrentSelections.ts sources/utils/helpers.ts
```

Expected: Prettier formats only listed files.

- [ ] **Step 2: 校验翻译 key 覆盖**

Run:

```bash
node -e "const fs=require('fs');const zh=JSON.parse(fs.readFileSync('lang/zh.json','utf8'));const en=JSON.parse(fs.readFileSync('lang/en.json','utf8'));const a=Object.keys(en).filter(k=>!(k in zh));const b=Object.keys(zh).filter(k=>!(k in en));if(a.length||b.length){console.error({missingInZh:a,missingInEn:b});process.exit(1)}console.log('translation keys aligned',Object.keys(zh).length)"
```

Expected: `translation keys aligned <number>`。

- [ ] **Step 3: 校验没有损坏字符或 `??` 占位**

Run:

```bash
node -e "const fs=require('fs');for(const f of ['lang/zh.json','lang/en.json']){const s=fs.readFileSync(f,'utf8');if(s.includes('\uFFFD')||/\"[^\"]*\?\?[^\"]*\"/.test(s)){console.error('bad text in '+f);process.exit(1)}}console.log('encoding text clean')"
```

Expected: `encoding text clean`。

- [ ] **Step 4: 类型检查**

Run: `npm run type-check`

Expected: exit 0。

- [ ] **Step 5: lint**

Run: `npm run lint`

Expected: exit 0。

- [ ] **Step 6: Node 测试**

Run: `npm run test:node`

Expected: `# fail 0`。

- [ ] **Step 7: 浏览器测试**

Run: `npm test`

Expected: Testem/Mocha 全部通过。

- [ ] **Step 8: 手动页面核查**

Run: `npm run dev`

手动打开默认地址，检查：

1. 左侧可用物品树：分类、物品、变体显示中文。
2. 展开 `身体颜色` 后，展开状态正常，重着色项显示中文。
3. 打开调色板弹窗，标题、版本/材质、颜色名显示中文。
4. 当前选择标签显示 `身体颜色（浅色）`、`人类男性（浅色）` 等中文组合。
5. 搜索框输入 `身体`、`眼睛`、`头发` 能匹配对应条目。
6. hover tooltip 中动画显示 `行走`、`待机` 等中文。
7. URL hash 仍使用英文稳定值，不出现中文物品名导致分享链接不可解析。

- [ ] **Step 9: 提交检查点（仅当用户明确要求提交时执行）**

不要在 Codex/Claude 会话中擅自提交。若用户明确要求提交，执行：

```bash
git add lang/i18n.ts lang/zh.json lang/en.json tests/node/state/i18n_spec.js tests/components/tree/ItemWithRecolors_spec.js tests/components/tree/ItemWithVariants_spec.js tests/components/tree/PaletteSelectModal_spec.js tests/components/tree/TreeNode_spec.js tests/components/selections/CurrentSelections_spec.js sources/components/tree/ItemWithRecolors.ts sources/components/tree/ItemWithVariants.ts sources/components/tree/PaletteSelectModal.ts sources/components/tree/TreeNode.ts sources/components/selections/CurrentSelections.ts sources/utils/helpers.ts
git commit -m "fix: complete simplified chinese localization"
```

---

## 自审清单

- 分类树汉化：由现有 `tests/node/state/i18n_spec.js` 覆盖。
- 物品基础名汉化：已确认 647 个生成物品名都有 `item.*`；保持现有覆盖测试。
- 重着色 label 汉化：Task 1/3/5/6 覆盖。
- 变体名汉化：Task 1/3/5 覆盖。
- 调色板弹窗汉化：Task 6 覆盖。
- 当前选择标签汉化且 hash 使用原始英文：Task 4 覆盖。
- 中文搜索：Task 4 覆盖。
- tooltip 动画名中文：Task 4 覆盖。
- 翻译 key 对齐、占位符和编码：Task 7 覆盖。

## 交付说明

完成后最终回复应包含：

- 修改的主要文件列表。
- 已运行验证命令及结果。
- 是否有未运行的浏览器/视觉测试及原因。
- 手动核查截图中“可用物品”树状选择器是否已完整中文显示。
