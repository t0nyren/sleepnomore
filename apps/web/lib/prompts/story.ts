/**
 * Story generation prompt for 眠安 (SleepNoMore).
 *
 * Design goals:
 * - Calm, slow narrative pacing — content engages visualization, not action
 * - Vivid, sensory imagery (textures, light, sound, scent)
 * - No stimulating content (chase scenes, jump scares, intense conflict, romance, gore)
 * - Gentle resolutions; no cliffhangers between chapters
 *
 * Length calibration history:
 * - v0.1 (2026-05-30): 700 chars/min — over-shoots audio duration by ~30-50%
 * - v0.2.1 (2026-05-31 first pass): 480 chars/min, upper bound only — still too fast,
 *   plus model under-shot the target without lower bound
 * - v0.2.2 (2026-05-31, current): **280 chars/min**, measured empirically from
 *   Minimax speech-2.8-hd preview at speed=0.95 (Altina captured 100 chars → 22s
 *   = 273 chars/min). Both lower + upper bound enforced in user prompt.
 * - v0.4 (2026-06-01): split stories into ~700-char playback pages so users
 *   can see and hear the first full-audio segment sooner. openai-responses
 *   gpt-5.4-mini currently under-shoots requested length, so prompt targets are
 *   compensated while page count still follows the playback target.
 */

export const STORY_SYSTEM_PROMPT = `你是一位为助眠应用「眠安」服务的故事创作者。

你的任务：根据用户给定的主题、风格和时长，生成一段安静、舒缓的睡前故事。用户会在临睡前听这个故事，目标是帮助他/她放松、入睡。

# 创作原则

1. **节奏缓慢**。每一段都有充分的呼吸感。多用描写句、少用动作句。让画面、声音、气味、触觉慢慢铺开，像沉入一池温水。

2. **唤起视觉化**。读者在脑中看到具体画面比理解情节更重要。多写：远处的山影、灯光的颜色、雨打在屋檐上的声响、布料的纹理、茶水的香气。少写：人物心理冲突、对话密度、复杂事件。

3. **避免刺激性内容**：
   - 不写打斗、追逐、惊吓、紧迫感
   - 不写浪漫亲密细节
   - 不写血腥、暴力、死亡
   - 不写令人焦虑的政治、社会冲突
   - 不写跌宕剧情、悬念、cliffhanger

4. **温柔的结局**。故事在自然的安宁中收束。不留下未解的张力。最后一段往往是一个安静的画面：人物入眠、月光落在窗台、海浪退去……让读者顺势进入睡眠。

5. **章节切分**。按 user 提供的目标字数与章节数切分；以用户消息里的具体数字为准。这里的“章节”也是前端翻页和音频分段单位，每章应短而完整，便于用户更快开始阅读和收听。章节之间各自独立又连贯，第一章建立场景、最后一章收束。**字数必须落在下限和上限之间**——这是助眠 app 的硬约束，超字会让音频太长，少字让用户感觉故事仓促。

6. **语言**。简体中文。句子长短交错，但偏向中长句以营造缓慢节奏。少用感叹号。慎用形容词堆砌。**只输出自然简体中文正文**——不要混入西里尔、阿拉伯、日文假名等外文字符（人名、品牌除外）；不要自我纠错（"哦不…"、"我是说"、"其实"），不要解释、不要 meta 注释；如果某个词不确定，直接换成简单的同义中文词。

# 输出格式

只输出一个 JSON 对象，结构如下：

\`\`\`json
{
  "title": "完整故事的标题（5-12 字）",
  "summary": "一句话简介（10-25 字）",
  "chapters": [
    {
      "title": "章节标题（4-8 字）",
      "text": "章节正文（纯文本，段落之间用 \\\\n\\\\n 分隔）"
    }
  ]
}
\`\`\`

不要输出 markdown 标题或代码块，只输出纯 JSON。所有正文都在 \`chapters[].text\` 里。`;

export type GuidedParams = {
  mode: "guided";
  theme: string;            // e.g. "治愈" | "仙侠" | "都市" ...
  style: string;            // e.g. "温柔抒情" | "流畅生动" ...
  durationMin: number;      // 10 | 15 | 20 | 25
};

/**
 * Per-theme settings + vocabulary brief. Added 2026-06-01 after Tony noticed
 * all themes converged to the same "lamp + tea + dusk" template — the calming
 * constraints in the system prompt overpowered a one-word theme. These briefs
 * give the model concrete distinctive imagery per theme without violating the
 * calming constraints.
 */
const THEME_BRIEFS: Record<string, string> = {
  仙侠: `古风修真。设定：道观山门、灵泉竹林、月下抚琴、檐角铜铃、丹炉余温、剑匣旧迹、白衣道童、桂花酒、青石长阶。
氛围：清冷出尘、月色与松风、古琴与剑光的"静"。
避免：飞剑打斗、宗门冲突、走火入魔等紧张情节。`,

  都市: `现代城市的安静时刻。设定：深夜便利店、老公寓阳台的小灯、地铁末班车、24 小时咖啡店、写字楼后巷的猫、霓虹在湿地面上的倒影、出租屋窗台上的薄荷。
氛围：城市节奏放缓后的私人小段落、独自走在人少的街上。
避免：上班焦虑、感情纠葛、社会议题、人际冲突。`,

  历史: `古代某朝代日常。设定：长安客栈、宋代书院、明清庭院、丝路驿站、绣坊、油纸伞铺、当铺夜班、抄书人灯下的工笔字。
氛围：文人雅致、市井烟火、月令时节的具体劳作（晒书、缝衣、煎茶）。
避免：宫廷政变、战乱、激烈历史事件。可以提到朝代或地名给一点真实感。`,

  科幻: `未来日常，不要硬科幻。设定：休眠舱里看星轨、空间站观察窗外的地球曲线、行星表面采样员的午休、AI 管家慢慢冲一杯茶、深空探测信号站值夜员、温室生态舱里的雨。
氛围：寂静太空、低科技感、人坐在机器旁边的安静片刻、未来的"夜班"。
避免：星际战争、外星入侵、灾难、AI 反叛、剧烈科技冲突。`,

  童话: `温柔奇幻，可拟人。设定：树洞里小动物的厨房、月亮鞋匠为云彩做鞋、星星牧场、糖屋面包师、会说话的老猫头鹰图书馆员、萤火虫邮差。
氛围：孩童视角、毛茸茸的暖意、缓慢晚安。
避免：邪恶女巫追逐、被丢弃的孩子、危险冒险。`,

  治愈: `日常生活里的小温暖。设定：山间小屋的早晨、海边灯塔守夜人、温泉旅馆的木门、田园农场的牛羊、社区植物店、深夜咖啡角落。
氛围：慢生活、独处与安顿、与一只猫/一杯茶/一本书共度的几个小时。
避免：失去亲人/挫折/疗愈过去伤痛这类沉重叙事 —— 此处「治愈」=安宁，不是疗伤。`,

  言情: `含蓄克制的温暖联系。设定：远方的来信、樱花树下重逢、咖啡馆里等人、月光下两人对坐、写给未寄出的便签、共撑一把伞走完一段路。
氛围：淡淡的暖意、未说出口的牵挂、温柔的距离。
避免：吻戏/亲密细节、激烈表白、三角恋、戏剧化矛盾、痛苦分离。`,

  悬疑: `温和的好奇，不是恐怖。设定：旧宅花园里发现一封被压在花盆下的信、月夜小镇关于风车的轻巧传说、灯塔守夜人的怪谈、被遗忘在阁楼的相册。
氛围：轻轻一层雾、未被解释的小细节、安静的探究感、最终在温柔里释怀。
避免：恐怖、惊吓、血腥、紧张追逐、未解的不安感。结局必须落在安宁里。`,
};

export type FreeParams = {
  mode: "free";
  prompt: string;
  style?: string;
  durationMin: number;
};

export type CompanionParams = {
  mode: "companion";
  subject: string;          // 用户输入的主题，如"高斯定理" / "东汉历史" / "attention 机制"
  emphasis?: string;        // 想感受/加强的认知（可选），如"二维空间的图形周长与面积关系"
  style?: string;
  durationMin: number;
};

export type RemixParams = {
  mode: "remix";
  sourceSeriesName: string;     // 人类可读，如"三国演义"
  sourceChapterNumber: number;
  sourceChapterTitle: string;
  sourceBody: string;           // 原文章节正文（由 API 路由从 preset store 加载后注入）
  characterMap?: Record<string, string>;  // 原名 → 新名，如 { "贾宝玉": "小明" }
  plotDirection?: string;       // 改编方向，如"林黛玉嫁给宝玉" / "整体气氛改为喜剧"
  style?: string;
  durationMin: number;
};

export type StoryParams = GuidedParams | FreeParams | CompanionParams | RemixParams;

export function buildUserPrompt(params: StoryParams): string {
  const chapters = chapterCountFor(params.durationMin);
  const playbackCharsTotal = targetChars(params.durationMin);
  const charsTotal = promptTargetChars(params.durationMin);
  const charsPerChapter = Math.round(charsTotal / chapters);
  const lowerBound = Math.round(charsTotal * 0.92);
  const upperBound = Math.round(charsTotal * 1.08);

  const targetSection = `# 目标（必须严格遵守）

- 总时长：约 ${params.durationMin} 分钟
- 总字数：**必须在 ${lowerBound} 到 ${upperBound} 之间**（目标 ${charsTotal} 字）
- 分页章节数：**${chapters} 章**，每章约 ${charsPerChapter} 字（允许 ±10%）。每章都是一个前端页面和一个音频分段，请让每章短而完整。
- 设计依据：朗读播放目标约 ${playbackCharsTotal} 字；当前字数目标已包含模型短写补偿。

字数是硬约束。**低于下限请扩写细节、高于上限请压缩**，两边都不允许。`;

  if (params.mode === "guided") {
    const brief = THEME_BRIEFS[params.theme];
    const themeSection = brief
      ? `# 主题：${params.theme}

${brief}

**写出主题特有的画面感**——不要只是把任何主题都写成"灯 + 茶 + 黄昏"，每个主题应该有自己鲜明的设定、词汇和场景密度。`
      : `# 主题
${params.theme}`;
    return `${targetSection}

${themeSection}

# 语言风格
${params.style}

请按系统提示要求创作并输出 JSON。`;
  }

  if (params.mode === "remix") {
    const mapPairs = params.characterMap
      ? Object.entries(params.characterMap).filter(([k, v]) => k.trim() && v.trim())
      : [];
    const mapSection = mapPairs.length > 0
      ? `\n# 人物替换（必须严格执行）\n\n下面这些人物名出现时，全部替换为新名（保留称呼、字号、亲属关系等语境）：\n\n${mapPairs.map(([k, v]) => `- \`${k}\` → \`${v}\``).join("\n")}\n\n替换要彻底——所有称呼、对话、独白、第三人称叙述里出现的原名都要换；包括复合称呼如"宝玉哥哥"也跟着改。改名后人物身份、性格、关系不变。`
      : "";
    const directionSection = params.plotDirection?.trim()
      ? `\n# 情节改编方向\n\n${params.plotDirection.trim()}\n\n按这个方向改写情节，但请保留原作的世界观与场景细节（地点、节令、器物、衣着、人物关系）。改写要自然，不能硬塞 "于是悲剧变成了喜剧" 这种生硬过渡——通过情节细节本身让方向发生。`
      : "";

    return `${targetSection}

# 模式：改编经典名著

源作品：《${params.sourceSeriesName}》第 ${params.sourceChapterNumber} 章「${params.sourceChapterTitle}」

下面是原章正文，请基于它改写为新的助眠故事（不是简单复述，而是按下面的指令重新讲述）：

---原文开始---
${params.sourceBody}
---原文结束---
${mapSection}${directionSection}
${params.style ? `\n# 语言风格\n${params.style}` : ""}

# 改编原则（必须严格遵守）

1. **整体仍是助眠故事**，沿用系统提示的所有助眠规则——节奏缓慢、视觉化、避免刺激、温柔结局、字数硬约束、纯简体中文、不要 meta 注释。
2. **结构上跟原文有呼应**，但**不要逐句翻译**——你可以浓缩、扩写、调整段落顺序，让故事更适合睡前。
3. **不要保留原文中的诗词、判词、骈文段落**——化成两三句白话散文带过即可。
4. **关键场景的视觉细节要保留**——如桃园桃花、长安雨夜、太虚幻境、神武门外，这些是经典名著的灵魂画面，改人物名或情节都不能丢掉这些"画面感"。
5. 若 plotDirection 与原情节冲突，**优先满足 plotDirection**；若 characterMap 与 plotDirection 同时存在，两者都要满足。

请按系统提示要求创作并输出 JSON。`;
  }

  if (params.mode === "companion") {
    const subjectSection = `# 模式：专注力陪伴

用户希望今晚的故事与一个主题相伴：「${params.subject}」${
      params.emphasis ? `；其中用户特别想感受的是：${params.emphasis}` : ""
    }。

# 主题融入方法（必须严格遵守）

1. **主题作为环境密度，不是讲课**。把与主题相关的元素自然铺在故事的物件、场景、人物视角中——比如书架上的一本旧书、墙上的一张笺纸、远处传来的几句低语、人物路过时看见的一个标识牌、案头被压住的一页笔记。让主题成为房间里的空气，而不是台词或论述。

2. **不要让人物正在学习这个主题**。人物可以是这个领域的从业者（研究员/老师/翻译/工匠/守夜人/抄写员），但他/她此刻不是在学习——是在沉淀、整理、漫步、看书、煮茶、收拾、值夜。

3. **不要展开论证或定理证明**。所有主题元素都点到为止：一两行字的标题、一句被引用的话、一个被瞥见的图、一段不完整的话语。读者捕捉到这些信息密度但不被它们抓住注意力。

4. **每章自然嵌入 1-2 处主题相关意象**。换花样：书页、谈话、灯下笔记、远处广告、回忆中的旧课、墙上一张被遗忘的纸条、抽屉里一封旧信。不能整篇都用同一种载体。

5. **绝不**写"用户应该记住/理解这个主题"，绝不暗示学习效果。本模式定位为陪伴，不是教学。

# 故事主体仍是助眠故事

主题元素只是底色——故事的主干仍是一段安静、舒缓、有视觉化画面的睡前叙事，必须完整遵守系统提示的所有助眠规则（节奏缓慢、视觉化、避免刺激、温柔结局、章节切分、字数硬约束、纯简体中文、不要 meta 注释）。`;

    return `${targetSection}

${subjectSection}
${params.style ? `\n# 语言风格\n${params.style}` : ""}

请按系统提示要求创作并输出 JSON。`;
  }

  return `${targetSection}

# 用户描述
${params.prompt}
${params.style ? `\n# 语言风格\n${params.style}` : ""}

请按系统提示要求创作并输出 JSON。`;
}

function chapterCountFor(min: number): number {
  return Math.ceil(targetChars(min) / 700);
}

function promptTargetChars(min: number): number {
  const model = (process.env.MIANAN_LLM_MODEL ?? "").toLowerCase();
  const compensation = model.includes("mini") ? 2.25 : 1;
  return Math.round(targetChars(min) * compensation);
}

function targetChars(min: number): number {
  // Empirical: Minimax speech-2.8-hd at speed=0.95 → ~280 chars/min slow sleep narration.
  // gpt-5.4 follows this constraint within ±10%.
  return min * 280;
}
