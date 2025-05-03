# LPC 精灵表角色生成器  
=============================================

本生成器尝试整合迄今为止所有由[LPC](https://lpc.opengameart.org)创作的角色素材。

[点击此处在线试用](https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/)。

Liberated Pixel Effort 是由多位优秀艺术家共同协作的成果，他们为该项目创作了大量精灵素材。  
**若您希望在项目中使用LPC精灵素材，必须为所有贡献者署名**，具体方式请参见[下方署名要求](#许可协议与署名要求)。

虽然本仓库主要聚焦角色精灵素材，但LPC还包含许多瓦片集和其他艺术作品。瓦片集合集可在[OpenGameArt.org](https://opengameart.org)获取。

### 历史沿革

Liberated Pixel Cup的概念由Bart Kelsey和Chris Webber提出，最初是[OpenGameArt.org](https://opengameart.org)上由Creative Commons、Mozilla和自由软件基金会赞助的比赛（注：这些组织与本生成器无关）。其目标是建立遵循统一[风格指南](https://lpc.opengameart.org/static/LPC-Style-Guide/build/index.html)的艺术素材库。

本项目最初基于[makrohn的仓库](https://github.com/makrohn/Universal-LPC-spritesheet)，该仓库通过xcf文件整合了所有PNG素材。特别感谢[@makrohn](https://github.com/makrohn)创建了首个（离线版）LPC精灵表生成器。

[@Gaurav0](https://github.com/Gaurav0)是本仓库的原作者，后由[@sanderfrenken](https://github.com/sanderfrenken)长期维护主要分支。目前由[@jrconway3](https://github.com/jrconway3)和[@bluecarrot16](https://github.com/bluecarrot16)负责艺术方向的维护工作。

[@ElizaWy](https://github.com/ElizaWy)对LPC范式进行了革新扩展，详见[其仓库](https://github.com/ElizaWy/LPC)。

### 许可协议与署名要求

本项目中分发的所有艺术作品（`spritesheets`子目录下的图像）均采用以下一种或多种开源许可协议：

- [CC0](https://creativecommons.org/public-domain/cc0/)  
  可无条件使用，无需署名
- [CC-BY-SA](https://creativecommons.org/licenses/by-sa/4.0/deed.zh)[^2]  
  必须署名作者，不得加密或DRM保护[^1]  
  且衍生作品必须采用相同协议发布
- [CC-BY](https://creativecommons.org/licenses/by/4.0/)  
  必须署名作者，不得加密或DRM保护[^1]
- [OGA-BY](https://static.opengameart.org/OGA-BY-3.0.txt)  
  必须署名作者，允许在DRM加密游戏中使用
- [GPL](https://www.gnu.org/licenses/gpl-3.0.en.html#license-text)  
  衍生作品必须采用GPL 3.0或更高版本发布

[^1]: 关于DRM条款的注意事项：若计划在Steam/iOS等DRM平台发布游戏，建议优先使用CC0或OGA-BY协议素材以避免法律风险。  
[^2]: 这是本生成器中最严格的许可协议，遵守该协议即可使用仓库内所有素材（包括商业游戏）。

**使用本工具生成的精灵或直接使用`spritesheets`目录中的素材时，必须为非CC0素材的所有作者署名。**

生成器可下载包含所选素材完整许可信息的CSV/文本文件：  
![授权文件截图](/readme-images/credits-sheet.png)

您也可以直接使用[CREDITS.csv](/CREDITS.csv)文件，其中列出了所有素材的作者、许可协议及原始链接。

合规署名方式任选其一：
- 在项目中完整分发[CREDITS.csv](/CREDITS.csv)文件
- 制作仅包含所用素材的署名清单

请确保用户能在游戏/应用中便捷查看该文件（如在"制作人员"界面直接展示或提供明显链接）。

**重要提示：不同协议可能有额外要求，您有责任遵守所用素材的许可条款。**

若不愿直接展示完整署名文件，建议在制作人员界面添加如下声明：

> - 精灵素材作者：Johannes Sjölund (wulax)、Michael Whitlock (bigbeargames) 等（完整列表见下方链接）  
> - 素材来源：OpenGameArt.org的Liberated Pixel Cup项目  
> - 许可协议：CC-BY-SA 3.0  
> - 详细署名信息：[CREDITS.csv文件链接]

更多授权信息请参考[OpenGameArt.org常见问题](https://opengameart.org/content/faq#q-proprietary)。

### [参与贡献](CONTRIBUTING.md) ⤴

### 动画帧指南

建议参考[Eliza仓库中的动画指南](https://github.com/ElizaWy/LPC/blob/f07f7f5892e67c932c68f70bb04472f2c64e46bc/Characters/_%20Guides%20%26%20Palettes/Animation%20Guides)了解推荐的动画实现方式。每个动画的帧循环信息可在预览界面查看。

### 本地运行

传统方式可直接在浏览器打开`index.html`，但现代浏览器的安全限制可能导致问题。推荐以下本地服务器方案：
- IIS（仅Windows）
- Python（`py -m http.server <端口>`）
- Rust（Simple Http Server）
- Node.js（`require('http')`）
- nginx
- npx serve
- brew serve（仅Mac）
- Lighttpd

### 常见问题

<dl>
  <dt>能否用于商业游戏？</dt>
  <dd>可以，但必须遵守所用素材的许可条款（详见署名要求章节）</dd>
  <dt>如何在XX游戏引擎中使用？</dt>
  <dd>未来将提供常见引擎的适配指南，目前建议通过搜索引擎查找解决方案，多数情况需要自行编写代码</dd>
  <dt>下载图像后忘记保存授权信息怎么办？</dt>
  <dd>建议通过"导出JSON"功能同时保存图像和元数据.参见[issue #143](https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator/issues/143)</dd>
</dl>


### 术语表

<dl>
  <dt>Liberated Pixel Cup (LPC)</dt>
  <dd>最初为创建兼容艺术素材库的比赛，现指该素材库及其风格规范</dd>
  <dt>Universal LPC (ULPC)</dt>
  <dd>LPC的扩展版本，增加了新动画尺寸和基础动作，最显著的特点是加入了超尺寸武器动画帧</dd>
  <dt>LPC Revised (LPCR)</dt>
  <dd>由[@ElizaWy](https://github.com/ElizaWy)提出的修订版，调整了动画帧数和顺序，采用新调色板和更小的头部比例</dd>
  <dt>LPC Expanded (LPCE)</dt>
  <dd>进一步扩展的版本，新增攀爬、奔跑、跳跃等动画，以及儿童和老年人基础模型（急需更多素材贡献）</dd>
</dl>

### 其他LPC角色生成器

- https://pflat.itch.io/lpc-character-generator  
- https://vitruvianstudio.github.io/

### 工具集

- [lpctools](https://github.com/bluecarrot16/lpctools)  操纵像素艺术精灵和tilesets的工具。
- [安装指南](tools/LPCTOOLS.md)  
- [使用lpctools重新编译完整精灵表](tools/REBUILD.md)  
- [素材转换工具](tools/VITRUVIAN.md)  

### 效果示例
![示例图片](/readme-images/example.png)