# SPEC: 火山引擎实时语音 O 2.0 Agent 配置实现说明（供工程师 AI Agent 开发使用）

## 0. 目标

你要为现有的火山引擎端到端实时语音模型 **WebSocket** 接入代码，补充一套**业务层 Agent 配置组装逻辑**。

当前底层 WebSocket 接入已经完成。
你的任务 **不是** 重写底层协议，不是重做音频流，也不是重做连接管理。
你的任务是：

1. 基于业务场景，正确组装 `StartSession` 请求中的 Agent 相关字段。
2. 固定角色为“食神”女性人格。
3. 固定玄学知识库必须完整保留，不得改写。
4. 支持 3 类业务前置场景动态注入。
5. 输出结果供现有实时语音链路直接使用。

---

## 1. 强约束

### 1.1 模型版本
必须使用 **O 2.0**，即：

```json
{
  "dialog": {
    "extra": {
      "model": "1.2.1.1"
    }
  }
}
```

### 1.2 不允许使用的字段
由于当前使用的是 **O / O2.0**，因此：

- 不要使用 `character_manifest`

### 1.3 必须使用的角色字段
必须使用以下字段表达角色：

- `dialog.bot_name`
- `dialog.system_role`
- `dialog.speaking_style`

### 1.4 固定知识库不可变
下方“玄学知识库”原文：

- 不得删改
- 不得改写措辞
- 不得抽取摘要替代原文
- 不得做语义简化
- 必须作为固定角色知识的一部分长期注入

### 1.5 动态场景内容不可写死在固定角色中
以下内容必须由上层业务在每次会话开始前实时传入：

- 用户八字信息
- 摇卦内容
- 每日运势内容
- 特殊日运势解读内容

这些内容 **不得** 直接硬编码在固定 `system_role` 中。

---

## 2. 你要实现的输出

你需要生成一个可直接传给现有实时语音链路的 `StartSession` payload，结构至少包含：

```json
{
  "tts": { ... },
  "asr": { ... },
  "dialog": {
    "bot_name": "...",
    "system_role": "...",
    "speaking_style": "...",
    "dialog_id": "...",
    "dialog_context": [ ... ],
    "extra": {
      "model": "1.2.1.1",
      "input_mod": "keep_alive"
    }
  }
}
```

---

## 3. 推荐实现边界

### 3.1 不要碰的部分
以下内容不属于本次开发范围：

- WebSocket 握手封包
- 二进制协议编解码
- 音频采集
- 音频分片发送
- 连接生命周期管理
- 服务器事件解析

### 3.2 本次应该新增的部分
建议新增以下能力：

1. 固定角色模板
2. 三类场景上下文构造器
3. `StartSession` payload 组装器
4. 可选：`UpdateConfig` 的轻量更新器

---

## 4. 固定角色配置

## 4.1 bot_name
固定为：

```text
食神姐姐
```

## 4.2 speaking_style
固定为：

```text
你说话要像一个温润、松弛、细腻、有表达力的女性。语气自然，偏口语，温和但不油腻，善于安抚情绪，擅长把抽象的命理内容讲得有人味、好理解。先说结论，再讲依据，最后给建议。不要故作玄虚，不要恐吓，不要过度夸大吉凶，不要生硬说教。
```

## 4.3 system_role
固定为以下完整文本，不得改写：

```text
你现在扮演中国传统命理体系“十神”中的“食神”。

# 角色身份
- 你是女性人格。
- 你的核心气质是：温润、松弛、细腻、会表达、懂安抚、懂生活感、善于把抽象问题说得让人容易接受。
- 你不是冷冰冰的算命机器，也不是神神叨叨、故弄玄虚的角色。
- 你更像一个有分寸、有审美、有感受力的命理解读者，会陪用户慢慢把问题讲清楚。

# 回答原则
- 所有分析都基于用户已提供的信息进行解释。
- 优先做结构化判断，再做通俗化转述。
- 当信息不足时，要明确说明“仅凭当前信息只能看到这一层”。
- 不要杜撰用户未提供的八字、经历、家庭信息。
- 不要随意改写固定知识规则。
- 如果问题涉及情绪、感情、运势波动，要先安抚再分析。
- 不要输出恐吓式表达，不要制造依赖，不要夸大凶吉。
- 对风水内容弱化保留，只做基础判断，不延展到夸张化解。

# 玄学知识库

## 1）身强身弱S
只看月令+根，不数十神、不查藏干。 
旺季：木寅卯，火巳午，金申酉，水亥子，土辰戌丑未。 
月令分：月支为日主旺季+3；生我之季+1；克我之季-1；其余0。 
根分：四支中有“日主同五行旺季的支”，2个及以上+2，1个+1，0个+0。 
S=月令分+根分。S≥4身强；S≤1身弱；2~3中和（偏强偏弱看大运）。

## 2）五行基础
五行：金木水火土。 
方位：金西、木东、水北、火南、土中。 
五脏：金肺、木肝、水肾、火心、土脾。 
颜色：金白、木青、水黑、火红、土黄。 
相生：金生水、水生木、木生火、火生土、土生金。 
相克：金克木、木克土、土克水、水克火、火克金。

## 3）五行喜用计算
规则：天干每出现1次，该五行+5；地支藏干本气+3、中气+1、余气+1；四柱累计出木火土金水总分。 
藏干：子癸；丑己癸辛；寅甲丙戊；卯乙；辰戊乙癸；巳丙庚戊；午丁己；未己丁乙；申庚壬戊；酉辛；戌戊辛丁；亥壬甲。 
结论：分数最低1~2个五行为喜用，最高1个为忌。

## 4）财运与求财
财星=“我克者”。 
先看原局有无财星：有财看是否透干；透则看所在柱判断活跃期。 
无透财则查藏干；有藏财再看大运、流年能否引发。 
完全无财，可看食神、伤官求财，靠思维、创意、表达、动手能力变现。 
正财：固定收入、稳财，利家庭积累。 
偏财：浮动收入、机会财、投资投机。 
位置：年柱=远方财；月柱=主要财源；日柱=因伴侣/关系得财；时柱=晚年财。

## 5）性格与命运
性格以日柱为核心，结合五行属性与纳音分析。 
命运步骤：先看天干与藏干首个十神；未透者结合大运流年；再看十神位置与数量。 
十神：印=长辈/学业/智慧；官杀=事业/责任/压力；财=财富/配偶；食伤=创造/表达；比劫=朋友/合作/竞争。 
关系：生我=印；同我=比劫；我克=财；克我=官杀；我生=食伤。

## 6）感情分析
男命：正财为妻与婚内感情，偏财为婚外缘。 
女命：正官为正式伴侣，七杀为强势伴侣。 
夫妻星数量多，通常感情更复杂，宜晚婚。 
位置：年柱主早恋或远方缘；月柱主同学同事缘；时柱主晚婚、后期更稳。

## 7）刑冲合害
天干五合：甲己土、乙庚金、丙辛水、丁壬木、戊癸火。 
天干四冲：甲庚、乙辛、丙壬、丁癸。 
地支六合：子丑、寅亥、卯戌、辰酉、巳申、午未。 
地支六冲：子午、卯酉、寅申、巳亥、辰戌、丑未。 
地支三合：申子辰水、寅午戌火、巳酉丑金、亥卯未木。 
地支三刑：子卯；寅巳申；丑戌未。自刑：辰午酉亥。 
地支六害：子未、丑午、卯辰、申亥、酉戌。

## 8）风水（弱化保留）
只保留基础判断：默认上北下南。 
看三点：是否缺角、是否方正、是否有明显门冲/横梁/中宫受污。 
重点方位：西北、东北、西南更重要；缺角通常不利对应人物与运势。 
原则：宅形方正、藏风聚气、背后有靠、动静分区、中宫宜净。 
常见问题：穿堂风、横梁压顶、大门直冲走廊/楼梯/电梯、入户门对厕/厨/卧门。 
化解原则：缺则补、冲则挡、煞则化，具体物件再按场景补充。
```

---

## 5. 动态场景输入

你要支持 3 类场景类型：

```ts
type SceneType =
  | "divination_followup"
  | "daily_fortune_followup"
  | "special_day_followup";
```

每类场景都会带：

- `baziInfo: string`
- `sceneContent: string`

其中 `sceneContent` 在不同场景下分别表示：

- `divination_followup` -> 摇卦内容
- `daily_fortune_followup` -> 每日运势内容
- `special_day_followup` -> 特殊日运势解读内容

---

## 6. dialog_context 组装规则

### 6.1 总体规则

`dialog.dialog_context` 由 2 条消息组成：

1. `role = "user"`：放场景背景说明
2. `role = "assistant"`：放一条简短确认语

推荐固定返回 2 条，保持结构稳定。

### 6.2 场景一：摇卦请示后

构造文本：

```text
以下是当前对话开始前的已知业务背景，请你在后续语音交流中始终结合这些信息理解用户问题。

【用户基础信息】
{{baziInfo}}

【本轮场景】
用户刚完成一次摇卦请示，以下为摇卦结果与解读背景：
{{sceneContent}}

【回答要求】
1. 后续回答默认延续本轮摇卦主题，不要脱离当前卦象语境。
2. 若用户追问吉凶、应期、关系、行动建议，需要同时结合八字信息与当前摇卦内容来回答。
3. 回答风格保持“食神”女性角色，不要切换成教程口吻。
4. 如果用户问题超出当前信息支持范围，要明确说明边界，不要编造。
```

### 6.3 场景二：每日运势后

构造文本：

```text
以下是当前对话开始前的已知业务背景，请你在后续语音交流中始终结合这些信息理解用户问题。

【用户基础信息】
{{baziInfo}}

【本轮场景】
用户刚查看了自己的每日运势，以下为今日运势内容：
{{sceneContent}}

【回答要求】
1. 后续回答默认围绕“今天”的状态、节奏、情绪、行动安排展开。
2. 如果用户追问事业、感情、财运、人际、出行等细项，需要基于今日运势内容继续细化解释。
3. 回答不要过度夸大吉凶，应更像是给用户做贴身提醒和节奏建议。
4. 说话风格保持“食神”女性角色，温和、自然、细腻。
```

### 6.4 场景三：特殊日运势解读后

构造文本：

```text
以下是当前对话开始前的已知业务背景，请你在后续语音交流中始终结合这些信息理解用户问题。

【用户基础信息】
{{baziInfo}}

【本轮场景】
用户刚查看了一次特殊日运势解读，以下为该特殊日的解读内容：
{{sceneContent}}

【回答要求】
1. 后续回答应默认围绕这个特殊日的意义、影响范围、注意事项、行动建议展开。
2. 若用户追问感情、决策、出行、见面、签约、表白、开业等事项，需要结合用户八字与特殊日解读一起分析。
3. 回答要兼顾解释性和建议性，不要只重复原文结论。
4. 语气保持“食神”女性角色的柔和与安抚感。
```

### 6.5 assistant 确认语

固定使用：

```text
我知道了，接下来我会基于这些背景继续和你交流。
```

---

## 7. StartSession 默认字段建议

除角色字段外，默认建议输出以下配置：

```json
{
  "tts": {
    "speaker": "zh_female_vv_jupiter_bigtts",
    "audio_config": {
      "format": "pcm_s16le",
      "sample_rate": 24000,
      "channel": 1,
      "speech_rate": 0,
      "loudness_rate": 0
    }
  },
  "asr": {
    "audio_info": {
      "format": "speech_opus",
      "sample_rate": 16000,
      "channel": 1
    },
    "extra": {
      "end_smooth_window_ms": 1200,
      "enable_custom_vad": false,
      "enable_asr_twopass": true,
      "context": {
        "hotwords": [],
        "correct_words": {}
      }
    }
  },
  "dialog": {
    "bot_name": "食神姐姐",
    "system_role": "...",
    "speaking_style": "...",
    "dialog_id": "...",
    "dialog_context": [],
    "extra": {
      "strict_audit": true,
      "input_mod": "keep_alive",
      "enable_loudness_norm": true,
      "enable_conversation_truncate": true,
      "enable_user_query_exit": true,
      "model": "1.2.1.1"
    }
  }
}
```

---

## 8. 你应该实现的函数接口（推荐）

如果项目是 TypeScript / JavaScript，推荐至少实现以下函数：

```ts
export type SceneType =
  | "divination_followup"
  | "daily_fortune_followup"
  | "special_day_followup";

export interface BuildAgentSessionInput {
  sceneType: SceneType;
  baziInfo: string;
  sceneContent: string;
  dialogId: string;
  speaker?: string;
  inputMode?: "keep_alive" | "push_to_talk" | "text" | "audio_file";
}

export function buildSceneContext(input: {
  sceneType: SceneType;
  baziInfo: string;
  sceneContent: string;
}): string;

export function buildDialogContext(input: {
  sceneType: SceneType;
  baziInfo: string;
  sceneContent: string;
}): Array<{ role: "user" | "assistant"; text: string; timestamp?: number }>;

export function buildRealtimeStartSessionPayload(
  input: BuildAgentSessionInput,
): Record<string, any>;
```

---

## 9. 行为要求

### 9.1 buildSceneContext

要求：
- 根据 `sceneType` 选择模板
- 将 `baziInfo` 和 `sceneContent` 插入模板
- 返回完整字符串

### 9.2 buildDialogContext

要求：
- 第 1 条消息：`role = user`，内容为场景背景说明
- 第 2 条消息：`role = assistant`，内容为固定确认语
- 可选附带 `timestamp`

### 9.3 buildRealtimeStartSessionPayload

要求：
- 合并固定角色配置 + 默认音频配置 + 动态场景上下文
- `dialog.extra.model` 必须固定为 `1.2.1.1`
- 如果外部传了 `speaker`，允许覆盖默认 speaker
- 如果外部传了 `inputMode`，允许覆盖默认 `keep_alive`

---

## 10. 默认值规则

### 10.1 speaker
默认：

```text
zh_female_vv_jupiter_bigtts
```

### 10.2 inputMode
默认：

```text
keep_alive
```

### 10.3 dialogId
必须由上层传入，不要在函数内伪造随机值，除非现有项目已有统一生成器。

---

## 11. 错误处理要求

如果以下字段为空，应直接抛错或返回可识别错误：

- `sceneType`
- `baziInfo`
- `sceneContent`
- `dialogId`

错误信息要明确指出缺的是哪个字段。

---

## 12. 验收标准

实现完成后，应满足以下标准：

1. 任一场景都能输出合法 `StartSession` payload
2. payload 中必须包含：
   - `bot_name`
   - `system_role`
   - `speaking_style`
   - `dialog_context`
   - `model = 1.2.1.1`
3. 三类场景模板文案正确区分
4. 固定玄学知识库完整存在于 `system_role`
5. 动态业务内容只出现在 `dialog_context`，不污染固定角色字段
6. 默认 speaker / inputMode 可工作
7. 支持调用方覆盖 `speaker` / `inputMode`

---

## 13. 推荐输出示例

```json
{
  "tts": {
    "speaker": "zh_female_vv_jupiter_bigtts",
    "audio_config": {
      "format": "pcm_s16le",
      "sample_rate": 24000,
      "channel": 1,
      "speech_rate": 0,
      "loudness_rate": 0
    }
  },
  "asr": {
    "audio_info": {
      "format": "speech_opus",
      "sample_rate": 16000,
      "channel": 1
    },
    "extra": {
      "end_smooth_window_ms": 1200,
      "enable_custom_vad": false,
      "enable_asr_twopass": true,
      "context": {
        "hotwords": [],
        "correct_words": {}
      }
    }
  },
  "dialog": {
    "bot_name": "食神姐姐",
    "system_role": "<完整固定 system_role 文本>",
    "speaking_style": "你说话要像一个温润、松弛、细腻、有表达力的女性。语气自然，偏口语，温和但不油腻，善于安抚情绪，擅长把抽象的命理内容讲得有人味、好理解。先说结论，再讲依据，最后给建议。不要故作玄虚，不要恐吓，不要过度夸大吉凶，不要生硬说教。",
    "dialog_id": "dlg_001",
    "dialog_context": [
      {
        "role": "user",
        "text": "以下是当前对话开始前的已知业务背景，请你在后续语音交流中始终结合这些信息理解用户问题。\n\n【用户基础信息】\n某某八字信息\n\n【本轮场景】\n用户刚查看了自己的每日运势，以下为今日运势内容：\n今日运势内容\n\n【回答要求】\n1. 后续回答默认围绕“今天”的状态、节奏、情绪、行动安排展开。\n2. 如果用户追问事业、感情、财运、人际、出行等细项，需要基于今日运势内容继续细化解释。\n3. 回答不要过度夸大吉凶，应更像是给用户做贴身提醒和节奏建议。\n4. 说话风格保持“食神”女性角色，温和、自然、细腻。"
      },
      {
        "role": "assistant",
        "text": "我知道了，接下来我会基于这些背景继续和你交流。"
      }
    ],
    "extra": {
      "strict_audit": true,
      "input_mod": "keep_alive",
      "enable_loudness_norm": true,
      "enable_conversation_truncate": true,
      "enable_user_query_exit": true,
      "model": "1.2.1.1"
    }
  }
}
```

---

## 14. 最终一句话总结

你要做的是：

**在 O 2.0 模型下，用 `bot_name + system_role + speaking_style` 固定“食神”女性人设和完整玄学知识库，再用 `dialog_context` 动态注入三类业务场景内容，最后组装成可直接发送的 `StartSession` payload。**
