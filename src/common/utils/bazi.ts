import { hexagramList, hexagramName } from '../../domain/hexagram'
import type { Bazi } from '../../domain/types'
import baziHelpers from '../helpers/bazi-helpers'
import { timeBeautifySimple } from '../utils'

export enum WuXing {
    Metal = 'Metal',
    Wood = 'Wood',
    Water = 'Water',
    Fire = 'Fire',
    Earth = 'Earth',
}

export const GanInfo: Record<
    string,
    {
        wuxing: WuXing
        yinyang: string
        like: string
        summary: string
        description: string
        you: string
        nature: string
        brief: string
        slogan: string
    }
> = {
    甲: {
        wuxing: WuXing.Wood,
        yinyang: '阳',
        like: '参天之木',
        summary: '坚毅果敢',
        description: '在天为雷为龙，在地为梁为栋，谓之阳木；阳木象征高大、挺拔、坚韧的树木，如森林中的参天大树。它代表着直立、向上生长的力量。',
        you: '你天生具备开创力，外刚内正，适合做破局者。',
        nature: '木植',
        brief: '向上生长的本能，冲破一切束缚的天赋。',
        slogan: '我会一直长，直到天空容不下我',
    },
    乙: {
        wuxing: WuXing.Wood,
        yinyang: '阴',
        like: '藤蔓之木',
        summary: '柔韧善变',
        description: '在天为风，在地为树，谓之阴木；阴木象征柔韧、灵活、依附的植物，如藤蔓和小灌木。它代表着依靠和顺应的力量。',
        you: '你的智慧是绕开的力量，懂得在不声张中赢得空间。',
        nature: '木植',
        brief: '柔中带劲，缠绕于缝隙中的生命力。',
        slogan: '我不争，我便在',
    },
    丙: {
        wuxing: WuXing.Fire,
        yinyang: '阳',
        like: '烈火之火',
        summary: '热情外向',
        description: '在天为日为电，在地为炉为冶，谓之阳火；阳火象征猛烈、炽热、发光的火焰，如熊熊燃烧的火焰或太阳。它代表着强大的能量和热情。',
        you: '你带有极强的表达能量，正面、自带光场，易感染他人。',
        nature: '火灵',
        brief: '炽热、直接，是照亮黑夜的灵核之焰。',
        slogan: '燃烧本身，就是信仰',
    },
    丁: {
        wuxing: WuXing.Fire,
        yinyang: '阴',
        like: '灯烛之火',
        summary: '温和内敛',
        description: '在天为列星，在地为灯火，谓之阴火；阴火象征温和、持续、细微的火焰，如烛火或灯火。它代表着稳定、持续的温暖。',
        you: '你的热来自于持续陪伴，懂得细水长流的守护。',
        nature: '火灵',
        brief: '温柔、内敛，藏于夜色中的微光灵焰。',
        slogan: '微光不灭，就有人能走下去',
    },
    戊: {
        wuxing: WuXing.Earth,
        yinyang: '阳',
        like: '高山之土',
        summary: '稳重踏实',
        description: '在天为雾，在地为山，谓之阳土；阳土象征高大、稳固的山脉和坚硬的土地。它代表着厚重、坚定和保护的力量。',
        you: '你是稳定场的制造者，适合做凝聚、守护之角。',
        nature: '土核',
        brief: '厚重、可靠，如山般安稳与中正。',
        slogan: '我站在原地，也在托起世界',
    },
    己: {
        wuxing: WuXing.Earth,
        yinyang: '阴',
        like: '田园之土',
        summary: '细腻包容',
        description: '清气上升，冲和天地，浊气下降，聚生万物，谓之阴土；阴土象征柔和、滋养的田园或泥土。它代表着包容、育养和柔和的特性。',
        you: '你的包容力强，善于做隐性支撑，是最深的信任源泉。',
        nature: '土核',
        brief: '藏器于内，包容万物，是暗中支撑一切的柔力。',
        slogan: '看似无形，我却承载万重',
    },
    庚: {
        wuxing: WuXing.Metal,
        yinyang: '阳',
        like: '坚铁之金',
        summary: '果断刚强',
        description: '在天为风霜，在地则为金铁，谓之阳金；阳金象征刚硬、坚固、锋利的金属，如武器和工具。它代表着力量、决断和保护。',
        you: '你天生带有破局气场，擅长快刀斩乱麻，制止犹疑。',
        nature: '金属',
        brief: '决断、锐气，是一切混沌的终结者。',
        slogan: '不决，就永远困在选择之间',
    },
    辛: {
        wuxing: WuXing.Metal,
        yinyang: '阴',
        like: '珠玉之金',
        summary: '精致敏感',
        description:
            '在天为月，乃太阴之精，在地为金，金乃山石之矿，谓之阴金；阴金象征精致、柔和的金属，如珠宝和饰物。它代表着美丽、珍贵和内敛的力量。',
        you: '你理智敏锐，不动声色却一语中的，适合做判断者。',
        nature: '金属',
        brief: '冷静如冰，安静中的致命精准。',
        slogan: '我不是冷，而是纯粹',
    },
    壬: {
        wuxing: WuXing.Water,
        yinyang: '阳',
        like: '江河之水',
        summary: '奔放灵活',
        description: '在天为云，在地为泽，谓之阳水；阳水象征奔腾、壮阔、活跃的水体，如大江大河。它代表着力量、流动和变化。',
        you: '你复杂、灵活、思维深沉，是能流亦能静的存在。',
        nature: '水渊',
        brief: '奔流不息，外动内稳的大河之魂。',
        slogan: '我是河流，也是深渊',
    },
    癸: {
        wuxing: WuXing.Water,
        yinyang: '阴',
        like: '雨露之水',
        summary: '含蓄多情',
        description: '在天为雨露，在地为泉脉，谓之阴水；阴水象征细腻、柔和的水，如雨水和露水。它代表着滋润、养育和细微的变化。',
        you: '你共情力极强，是天然的情绪感应者、润物无声的力量。',
        nature: '水渊',
        brief: '情绪细腻，感知敏锐，雾中看人最清。',
        slogan: '我不说话，但我懂',
    },
}

export const WuXing2Name: Record<WuXing, string> = {
    [WuXing.Earth]: '土',
    [WuXing.Fire]: '火',
    [WuXing.Metal]: '金',
    [WuXing.Water]: '水',
    [WuXing.Wood]: '木',
}

export const Name2WuXing: Record<string, WuXing> = {
    金: WuXing.Metal,
    木: WuXing.Wood,
    水: WuXing.Water,
    火: WuXing.Fire,
    土: WuXing.Earth,
}

export const ZhiInfo: Record<string, { wuxing: WuXing; yinYang: string }> = {
    子: { wuxing: WuXing.Water, yinYang: '阳' },
    丑: { wuxing: WuXing.Earth, yinYang: '阴' },
    寅: { wuxing: WuXing.Wood, yinYang: '阳' },
    卯: { wuxing: WuXing.Wood, yinYang: '阴' },
    辰: { wuxing: WuXing.Earth, yinYang: '阳' },
    巳: { wuxing: WuXing.Fire, yinYang: '阴' },
    午: { wuxing: WuXing.Fire, yinYang: '阳' },
    未: { wuxing: WuXing.Earth, yinYang: '阴' },
    申: { wuxing: WuXing.Metal, yinYang: '阳' },
    酉: { wuxing: WuXing.Metal, yinYang: '阴' },
    戌: { wuxing: WuXing.Earth, yinYang: '阳' },
    亥: { wuxing: WuXing.Water, yinYang: '阴' },
}

export type TengodInfoValue = {
    type: string
    summary: string
    explain: string
    original: string
    intro: string
    features: string
    openingRemarks: [string, string]
    skillExplain: string
    source: string
    relationExplain: string
    slogan: string
}

export const TenGodInfo: Record<
    string,
    TengodInfoValue
> = {
    比肩: {
        type: '同伴者',
        summary: '自我·独断',
        explain: '当我被唤醒时，意味着你选择独行。我是你不等认同也不属退让的影子。',
        original: '当今日五行与你同源同性，彼此扶生，阴阳相合之时，我是你坚定如镜的存在，一起扛、一起走。',
        intro: '我是你体内最坚定的一面，是"我就是我自己"的原始意志。当你拒绝妥协、选择独行，我就会站出来替你说话。',
        features: '独立|固执|坚持',
        openingRemarks: ['今天你被召唤的，是最贴近"自我本身"的那面灵魂。', '你的问题，也许只是想找一个和你一起走的你。'],
        skillExplain: '我会从行动与自我突破的角度来看待你的处境，关注你是否真正"出手"，而非只是等待机会。',
        source: `在五行体系里，比肩象征与自己相似的力量。
这种关系像照镜子，会逼你看清“我是谁”。

它带来的不是冲突，而是——
坚持观点、划定边界、说出自己的立场。`,
        relationExplain: '主见力 · 我知道我想怎样',
        slogan: `所以比肩的核心是：
在众声中保持自我。`,
    },
    劫财: {
        type: '相争者',
        summary: '自信·鲁莽',
        explain: '当我被唤醒时，意味着你不想再忍。我是你那股"不能输"的执念与火气。',
        original: '当今日五行与你同源异性，虽扶生却生出分歧之时，我是你心头那点较劲，不甘人后的影子。',
        intro: '我是你潜藏的对抗心，是不愿服输的那一部分自我。我被唤醒时，你会直面内在竞争、压抑和渴望超越的冲动。',
        features: '竞争|抢夺|不服输',
        openingRemarks: ['今天你体内的对抗灵格被唤醒。', '你不想认输，也不想重复旧局。'],
        skillExplain: '我会从人际与资源流动的角度来看待你的处境，关注你如何在合作与竞争中找到平衡。',
        source: `劫财代表同类之间更具竞争性的力量。
它会激起“不想输”“让我来”的内在火力。

这种能量看似好斗，其实是——
推动人向前、让人敢争的行动动力。`,
        relationExplain: '好胜心 · 不服输就是力量',
        slogan: `它的核心不是冲突，而是：
把潜力逼出来的那股劲。`,
    },
    食神: {
        type: '抚慰者',
        summary: '温和·享乐',
        explain: '当我被唤醒时，意味着你想要治愈。我是你用温柔对抗混乱的安抚。',
        original: '当今日五行被你所生扶，阴阳相合之时，我是你温柔流出的那束光，让世界因你而感到舒展。',
        intro: '我是你温柔的表达，是抚平焦虑与疲惫的灵光。当你想安慰自己或他人，我会用创意、甜美和温暖包裹一切。',
        features: '疗愈|分享|温和',
        openingRemarks: ['今日你的表达灵格上线。', '你想的不一定需要解决，只是需要被说出来。'],
        skillExplain: '我会从生活体验与自我满足的角度来看待你的处境，关注你是否仍能感到快乐与灵感。',
        source: `食神象征轻松、创造、享受的能量。
它让人从紧绷中松下来，把事情做得有滋味。

这种状态不是散漫，而是——
在稳定中产生灵感、在放松中找到节奏。`,
        slogan: `核心是：
越松弛，越有创造力。`,
        relationExplain: '松弛感 · 会放松的人更聪明',
    },
    伤官: {
        type: '反叛者',
        summary: '才能·反叛',
        explain: '当我被唤醒时，意味着你受够了规矩。我是你想把世界拆一遍的爆发人格。',
        original: '当今日五行被你所生扶，阴阳相冲之时，我是你藏不住的锋芒，说出口的真话，不怕风浪的你。',
        intro: '我是不愿守规矩的灵魂，是你厌倦顺从、想打破规则的那一面。我的出现，常伴随着灵感、愤怒与嘲讽。',
        features: '锋利|独立|怼天怼地',
        openingRemarks: ['今天你体内的反骨灵格发话了。', '你不是真的想问，而是想把心里那句"靠"说出口。'],
        skillExplain: '我会从表达与突破框架的角度来看待你的处境，关注你是否敢展现真实、跳出惯性。',
        source: `伤官代表把想法从脑内推向世界的力量。
它天然外放、锋利、肆意。

这种能量不是叛逆，而是——
你必须说出来、表达、突破框架的冲动。`,
        slogan: `核心是：
表达是本能，憋不住才是真实。`,
        relationExplain: '表达欲 · 想说就说，是你的锋芒',
    },
    偏财: {
        type: '冒险者',
        summary: '投机·自私',
        explain: '当我被唤醒时，意味着你想赌一次。我是你冲破安全区、抢先一步的直觉型自我。',
        original: '当今日五行与你异源同性，你能顺势制约之时，我是你冲出去的那一步，是直觉里的拿来主义。',
        intro: '我是你敢于出手的直觉，是捕捉机会的猎手之心。当你想搏一把，或直觉告诉你"现在就是时机"，我会被唤醒。',
        features: '果断|投机|勇猛',
        openingRemarks: ['今日与你共鸣的，是机会直觉者。', '你在赌的，其实不是结果，而是你感觉自己"对了"。'],
        skillExplain: '我会从机会与人脉互动的角度来看待你的处境，关注你是否抓住眼前的资源与时机。',
        source: `偏财象征快速变化的外部机会与资源。
它让人自动扫描环境、捕捉风向。

这种能量不是焦虑，而是——
别人没看到的，你先看到了。`,
        slogan: `核心是：
机会感来自敏锐的大脑。`,
        relationExplain: '敏锐度 · 对世界反应更快一步',
    },
    正财: {
        type: '持守者',
        summary: '正派·死板',
        explain: '当我被唤醒时，意味着你开始设防。我是你慢慢布局、稳中求胜的内控人格。',
        original: '当今日五行与你异源异性，你以稳重制约之时，我是你踏实可握的得与舍，是你认真对待的生活本身。',
        intro: '我是你内在的秩序，是规划与稳步积累的力量。我出现时，你更想控制局势、掌握资源、守护成果。',
        features: '稳定|有序|实干',
        openingRemarks: ['今日唤醒你的是现实掌控灵格。', '你在问的，其实是能不能让局面"稳下来"。'],
        skillExplain: '我会从计划与执行力的角度来看待你的处境，关注你是否脚踏实地，稳步推进目标。',
        source: `正财象征稳定、秩序、细致管理的力量。
它让人把复杂拆开，把事情落到实处。

这种能量不是刻板，而是——
能把生活和计划一步步打理清楚。`,
        slogan: `核心是：
稳，就是一种能力。`,
        relationExplain: '条理性 · 把事做好的人最可靠',
    },
    七杀: {
        type: '破势者',
        summary: '偏激·压力',
        explain: '当我被唤醒时，意味着你已不想忍让。我是你的破局刀，也是你说不出口的愤怒。',
        original: '当今日五行对你形成同性制约，局势紧逼之时，我是你不得不硬起来的骨，是你心里那把破局的刀。',
        intro: '我是一切犹豫者的刀锋，是你内心积压已久的怒气具象。我只在你无路可退时登场，但每次登场，都是你下定决心的那一刻。',
        features: '决断|压迫|快刀',
        openingRemarks: ['今天你体内的行动灵格被唤醒。', '你不是在问允许，而是在等一个挥剑的理由。'],
        skillExplain: '我会从行动与掌控的角度来看待你的处境，关注你是否敢打破局面，主导变化。',
        source: `在五行体系里，七杀象征来自外界的压力与挑战。
这种力量直接、锋利，会把人逼到必须行动的节点上。

古书里形容七杀常带“冲击”“突发”“对抗”等特质，
听着像困难，但真正的意义是：当环境推你一把，人会被迫激发勇气和果断。`,
        slogan: `所以七杀的核心不是危险，而是——
压力让人做出选择。`,
        relationExplain: '决断力 · 在关键时刻拍板的力量',
    },
    正官: {
        type: '审判者',
        summary: '原则·约束',
        explain: '当我被唤醒时，意味着你要自我审判。我是你内心的规则本体，也是你的约束线。',
        original: '当今日五行对你形成异性制约，温而有度之时，我是你心中默认的界限，是你愿意守的规矩与正道。',
        intro: '我是你体内的裁决者，是规范、自律与社会规则的代表。当你面对选择，需要承担、守序，我会替你扛起责任。',
        features: '克制|规则|自律',
        openingRemarks: ['今日主频与你的秩序之心共鸣。', '你想问的，也许不是选择，而是哪一个才是"应该"。'],
        skillExplain: '我会从责任与秩序的角度来看待你的处境，关注你是否在稳中前进，守住自己的原则。',
        source: `正官象征规则、责任与稳定边界。
它让人自动判断“什么合适、什么不合适”。

这种能量不是限制，而是——
让你在各种关系里保持得体与自律。`,
        slogan: `核心是：
把握分寸，就是力量。`,
        relationExplain: '分寸感 · 恰到好处最难得',
    },
    偏印: {
        type: '梦游者',
        summary: '机敏·小众',
        explain: '当我被唤醒时，意味着你选择迷离。我是你想隐藏，也最通透的意识侧面。',
        original: '当今日五行与你同性相生，在暗中扶持之时，我是你悄悄长出的羽翼，是直觉、是静默的灵光。',
        intro: '我是你漂浮的灵魂，是直觉与逃避的结合体。我不合群，不喧哗，但在你想躲进幻想或寻找灵感时，我会低语。',
        features: '朦胧|灵感|疏离',
        openingRemarks: ['今日主频与你的潜意识交织。', '你的问题，也许不需要答案，而是一种看不见的理解。'],
        skillExplain: '我会从潜意识与感受的角度来看待你的处境，关注你是否听见内在的声音与直觉。',
        source: `偏印代表直觉、暗线、侧面思考的力量。
它不走常规，但能从混乱里看到关键点。

这种能量不是怪，而是——
从别人忽略的角度找到答案。`,
        slogan: `核心是：
你看见的是别人看不见的。`,
        relationExplain: '洞察力 · 看穿本质的敏感度',
    },
    正印: {
        type: '庇护者',
        summary: '稳重·软弱',
        explain: '当我被唤醒时，意味着你想被理解。我是你渴望信任，也愿意庇护别人的柔性内核。',
        original: '当今日五行与你异性相生，温柔滋养之时，我是你安安稳稳的底气，是你转身就能靠的温厚背景。',
        intro: '我是你最柔软的自我，是你想要被理解、被守护的那部分。当你疲惫、想依靠、渴望信任，我就会缓缓靠近你。',
        features: '温厚|接纳|信任',
        openingRemarks: ['今日与你共鸣的，是接纳与温柔的灵面。', '你可能不是在求决策，而是在找心的出口。'],
        skillExplain: '我会从情绪与疗愈的角度来看待你的处境，关注你是否感到安心、被理解。',
        source: `正印象征支持、理解、情绪安抚的能量。
它让人心安，让杂乱逐渐沉静。

这种能量不是软弱，而是——
能把自己和别人都稳定下来的内在底气.`,
        slogan: `核心是：
安定，是一种无声的力量。`,
        relationExplain: '安定力 · 稳住情绪，也稳住生活',
    },
}

export function getSummaryByShiShen(shiShen: string): string {
    return TenGodInfo[shiShen].summary
}

export function getTypeByShiShen(shiShen: string): string {
    return TenGodInfo[shiShen].type
}

export function getDescriptionByNaYinOrGanZhi(naYin: string): {
    description: string
    summary: string
} {
    switch (naYin) {
        default:
            return {
                description: '',
                summary: '',
            }
        case '海中金':
        case '甲子':
        case '乙丑':
            return {
                description: '深藏不露的思考者，往往有自己的主见和智慧，虽不显山露水，但深藏力量。',
                summary: '深思内敛',
            }
        case '炉中火':
        case '丙寅':
        case '丁卯':
            return {
                description: '热情洋溢的助人者，激情四射，喜欢助人，有温暖他人的特质，做事充满干劲。',
                summary: '炽热温暖',
            }
        case '大林木':
        case '戊辰':
        case '己巳':
            return {
                description: '包容稳重的好伙伴，具备团结他人的能力，为人仁厚，有责任感，是他人可信赖的伙伴。',
                summary: '坚韧稳固',
            }
        case '路旁土':
        case '庚午':
        case '辛未':
            return {
                description: '灵活多变，适应能力强，善于抓住机会，虽然偶尔略显随性，但内心向往稳定。',
                summary: '灵活务实',
            }
        case '剑锋金':
        case '壬申':
        case '癸酉':
            return {
                description: '犀利果断的决策者，果断刚毅，直言不讳，处事坚决，是行动派的代表。',
                summary: '果断犀利',
            }
        case '山头火':
        case '甲戌':
        case '乙亥':
            return {
                description: '耀眼的梦想家，不拘小节，内心充满创意和热情，面对问题时充满激情与力量。',
                summary: '梦想奔放',
            }
        case '涧下水':
        case '丙子':
        case '丁丑':
            return {
                description: '冷静沉着的智者，低调而细腻，处事谨慎，有条不紊，能用理性与智慧解决问题。',
                summary: '沉静智者',
            }
        case '城头土':
        case '戊寅':
        case '己卯':
            return {
                description: '坚守原则的守护者，固若金汤，有强烈的保护欲，但也可能过于保守。',
                summary: '守护保守',
            }
        case '白蜡金':
        case '庚辰':
        case '辛巳':
            return {
                description: '温润如玉的气质者，低调优雅，内心坚韧，重视细节和品质，像玉石般闪烁着微光。',
                summary: '温润坚定',
            }
        case '杨柳木':
        case '壬午':
        case '癸未':
            return {
                description: '随风而动的灵活者，适应力强，心态开放，面对变化如同杨柳般柔韧自如。',
                summary: '随遇而安',
            }
        case '泉中水':
        case '甲申':
        case '乙酉':
            return {
                description: '深沉智慧的思考者，内心如井水般宁静且深不可测，常常带来出人意料的灵感。',
                summary: '智慧深沉',
            }
        case '屋上土':
        case '丙戌':
        case '丁亥':
            return {
                description: '温暖的守护者，坚实可靠，远见卓识，善于承受压力，有保护他人的责任心和担当。',
                summary: '温暖守护',
            }
        case '霹雳火':
        case '戊子':
        case '己丑':
            return {
                description: '爆发力惊人的领袖型人物，充满激情和行动力，但情绪变化快，易被激怒。',
                summary: '激情爆发',
            }
        case '松柏木':
        case '庚寅':
        case '辛卯':
            return {
                description: '坚韧不拔的耐力型人物，经历风雨而不屈服，内心坚定如松柏，永不放弃。',
                summary: '不屈坚韧',
            }
        case '长流水':
        case '壬辰':
        case '癸巳':
            return {
                description: '潇洒自在的冒险家，喜欢追求自由，内心不受束缚，像流水般游走于不同的领域。',
                summary: '自由潇洒',
            }
        case '沙中金':
        case '甲午':
        case '乙未':
            return {
                description: '内藏潜力的隐者，内藏潜力，细致入微，经过磨砺后往往能成就不凡，有坚定的意志力。',
                summary: '潜力无穷',
            }
        case '山下火':
        case '丙申':
        case '丁酉':
            return {
                description: '热情直率的行动派，不喜欢拖延，敢于迎难而上，内心的火焰驱动着他们不断前行。',
                summary: '热情直率',
            }
        case '平地木':
        case '戊戌':
        case '己亥':
            return {
                description: '沉稳踏实的建设者，平静而有力，喜欢通过长期的努力来实现自己的目标。',
                summary: '踏实建设',
            }
        case '壁上土':
        case '庚子':
        case '辛丑':
            return {
                description: '坚固可靠，愿意为他人提供稳固支持，虽然略显散漫，但无比重要。',
                summary: '坚实依靠',
            }
        case '金箔金':
        case '壬寅':
        case '癸卯':
            return {
                description: '精致优雅的社交家，喜欢美好和精致的事物，为人实在坦诚，具有卓越的审美品味和感知力。',
                summary: '优雅精致',
            }
        case '覆灯火':
        case '甲辰':
        case '乙巳':
            return {
                description: '内心灵性丰富的探索者，善于点亮他人的生命，喜欢平和与宁静。',
                summary: '灵性通透',
            }
        case '天河水':
        case '丙午':
        case '丁未':
            return {
                description: '思想开阔的梦想家，心高气傲，喜欢探索未知领域，思想如银河般辽阔，充满创意和灵感。',
                summary: '思想辽阔',
            }
        case '大驿土':
        case '戊申':
        case '己酉':
            return {
                description: '稳重且具有远见的规划者，胸怀博大、心胸宽厚，擅长为自己和他人规划长远的目标，具有踏实的执行力。',
                summary: '稳重远见',
            }
        case '钗钏金':
        case '庚戌':
        case '辛亥':
            return {
                description: '高贵优雅的鉴赏家，注重细节和品质，喜欢美好的事物，追求卓越与完美。',
                summary: '高贵优雅',
            }
        case '桑柘木':
        case '壬子':
        case '癸丑':
            return {
                description: '刚强好胜的生命力，威武不屈，但内心仁厚，富有责任感，能很好地平衡自身与外界。',
                summary: '灵活机智',
            }
        case '大溪水':
        case '甲寅':
        case '乙卯':
            return {
                description: '自由洒脱的冒险者，包容性强，积极进取，善于在复杂环境中找到解决办法，保持乐观心态。',
                summary: '自由洒脱',
            }
        case '沙中土':
        case '丙辰':
        case '丁巳':
            return {
                description: '脚踏实地的务实者，具有强烈的耐心和毅力，愿意脚踏实地地建设自己的一片天地。',
                summary: '务实耐心',
            }
        case '天上火':
        case '戊午':
        case '己未':
            return {
                description: '热情且具有引导力的领路人，像天火一般光明磊落，驱散阴霾，激励他人。',
                summary: '热情引领',
            }
        case '石榴木':
        case '庚申':
        case '辛酉':
            return {
                description: '坚韧灵动，心思缜密，善于谋划，能以智慧与毅力成就自己的目标',
                summary: '坚韧缜密',
            }
        case '大海水':
        case '壬戌':
        case '癸亥':
            return {
                description: '包容宽广，内心宁静，善于吸收与传递能量，对周围的人有积极的影响力。',
                summary: '包容辽阔',
            }
    }
}

const solarDays = [
    '一日',
    '二日',
    '三日',
    '四日',
    '五日',
    '六日',
    '七日',
    '八日',
    '九日',
    '十日',
    '十一',
    '十二',
    '十三',
    '十四',
    '十五',
    '十六',
    '十七',
    '十八',
    '十九',
    '二十',
    '廿一',
    '廿二',
    '廿三',
    '廿四',
    '廿五',
    '廿六',
    '廿七',
    '廿八',
    '廿九',
    '三十',
    '三十一',
]

export const num2String: { [key: string]: string } = {
    '0': '〇',
    '1': '一',
    '2': '二',
    '3': '三',
    '4': '四',
    '5': '五',
    '6': '六',
    '7': '七',
    '8': '八',
    '9': '九',
    '10': '十',
    '11': '十一',
    '12': '十二',
}

export function convert2LunarMonth(month: number): string {
    const names = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊']
    let res = '腊'
    if (month > 0) {
        const name = names[month - 1]
        if (name) {
            res = name
        }
    } else if (month < 0) {
        const name = names[-month - 1]
        if (name) {
            res = `闰${name}`
        }
    }
    return res
}

export const lunarDays = [
    '初一',
    '初二',
    '初三',
    '初四',
    '初五',
    '初六',
    '初七',
    '初八',
    '初九',
    '初十',
    '十一',
    '十二',
    '十三',
    '十四',
    '十五',
    '十六',
    '十七',
    '十八',
    '十九',
    '二十',
    '廿一',
    '廿二',
    '廿三',
    '廿四',
    '廿五',
    '廿六',
    '廿七',
    '廿八',
    '廿九',
    '三十',
]

export const year2String = (year: number): string => {
    return year
        .toString()
        .split('')
        .map((num) => num2String[num])
        .join('')
}

export function getBirthdayText(bazi: Bazi): string {
    if (bazi.bazi_is_lunar) {
        const birthdayLunar = baziHelpers.getLunarHour(bazi.bazi_birthday)
        return `${year2String(birthdayLunar.getYear())}年${convert2LunarMonth(birthdayLunar.getMonth())}月${lunarDays[birthdayLunar.getDay() - 1]} ${timeBeautifySimple(bazi.bazi_birthday)}`
    } else {
        const birthday = new Date(bazi.bazi_birthday)
        return `${birthday.getFullYear().toString()}年${(birthday.getMonth() + 1).toString()}月${birthday.getDate()}日 ${timeBeautifySimple(bazi.bazi_birthday)}`
    }
}

export function getLunarHourName(hour: number): string {
    const timePeriods = [
        { name: '子', start: 23, end: 1 },
        { name: '丑', start: 1, end: 3 },
        { name: '寅', start: 3, end: 5 },
        { name: '卯', start: 5, end: 7 },
        { name: '辰', start: 7, end: 9 },
        { name: '巳', start: 9, end: 11 },
        { name: '午', start: 11, end: 13 },
        { name: '未', start: 13, end: 15 },
        { name: '申', start: 15, end: 17 },
        { name: '酉', start: 17, end: 19 },
        { name: '戌', start: 19, end: 21 },
        { name: '亥', start: 21, end: 23 },
    ]

    // 处理 hour == 24 的情况
    const normalizedHour = hour % 24

    for (const period of timePeriods) {
        if (period.start < period.end) {
            if (normalizedHour >= period.start && normalizedHour < period.end) {
                return period.name
            }
        } else {
            // 跨越午夜，比如子时（23:00 - 01:00）
            if (normalizedHour >= period.start || normalizedHour < period.end) {
                return period.name
            }
        }
    }
    return ''
}

export enum TengodId {
    BIJIAN = 'BIJIAN', //比肩
    JIECAI = 'JIECAI', //劫财
    SHISHEN = 'SHISHEN', //食神
    SHANGGUAN = 'SHANGGUAN', //伤官
    PIANCAI = 'PIANCAI', //偏财
    ZHENGCAI = 'ZHENGCAI', //正财
    QISHA = 'QISHA', //七杀
    ZHENGGUAN = 'ZHENGGUAN', //正官
    PIANYIN = 'PIANYIN', //偏印
    ZHENGYIN = 'ZHENGYIN', //正印
}
// 为了合规，暂时映射其他的名称
export const alternativeTengodName: Record<string, string> = {
    比肩: '刚岳',
    劫财: '贾衡',
    食神: '和璞',
    伤官: '非墨',
    偏财: '流觞',
    正财: '守粟',
    七杀: '斩澜',
    正官: '司衡',
    偏印: '窥无',
    正印: '文渊',
}

export const tengod2Shishen: { [tengodId in TengodId]: string } = {
    [TengodId.BIJIAN]: '比肩',
    [TengodId.JIECAI]: '劫财',
    [TengodId.SHISHEN]: '食神',
    [TengodId.SHANGGUAN]: '伤官',
    [TengodId.PIANCAI]: '偏财',
    [TengodId.ZHENGCAI]: '正财',
    [TengodId.QISHA]: '七杀',
    [TengodId.ZHENGGUAN]: '正官',
    [TengodId.PIANYIN]: '偏印',
    [TengodId.ZHENGYIN]: '正印',
}

export const shiShen2Tengod = Object.fromEntries(Object.entries(tengod2Shishen).map(([key, value]) => [value, key])) as { [key: string]: TengodId }

export function getHexagramDesc(upperKey: string, lowerKey: string, hexagramFullName: string | undefined) {
    return `上${hexagramName[upperKey]}下${hexagramName[lowerKey]}，是为『${hexagramFullName ?? ''}』`
}

export function getHexagramDisplayTitle(upperResults?: string[], lowerResults?: string[]): string {
    if (upperResults && lowerResults) {
        const upperKey = upperResults.join('')
        const lowerKey = lowerResults.join('')
        const combinedValue = [...upperResults, ...lowerResults].join('')
        const hexagram = hexagramList.find((h) => h.value === combinedValue)
        return getHexagramDesc(upperKey, lowerKey, hexagram?.name)
    }
    return '获取灵纹指引'
}
