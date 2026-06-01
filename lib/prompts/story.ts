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

export type StoryParams = GuidedParams | FreeParams;

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
