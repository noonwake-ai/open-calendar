import { UserGender } from '../../domain/types'
import type { Bazi } from '../../domain/types'
import shenShaHelper from './shen-sha-helper'
import { convert2LunarMonth, GanInfo, lunarDays, WuXing, WuXing2Name, year2String, ZhiInfo } from '../utils/bazi'
import { timeBeautifySimple } from '../utils'
import { Long } from '../base'
import { ChildLimit, EightChar, Gender, LunarHour, SixtyCycleYear, SolarTime } from 'tyme4ts'

function getSolarTime(time: Long): SolarTime {
    const date = new Date(time)
    return SolarTime.fromYmdHms(date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds())
}

function getLunarHour(time: Long): LunarHour {
    const solar = getSolarTime(time)
    return solar.getLunarHour()
}

function getEightCharByTime(time: Long): EightChar {
    return getLunarHour(time).getEightChar()
}

function getGender(gender: UserGender): Gender {
    return gender === UserGender.female ? Gender.WOMAN : Gender.MAN
}

function getBaziDaYunAndLiuNian(gender: UserGender, birthtime: Long): [string[], string[]] {
    const childLimit = ChildLimit.fromSolarTime(getSolarTime(birthtime), getGender(gender))
    const dayHeavenStem = childLimit.getEightChar().getDay().getHeavenStem()
    const firstYear = childLimit.getStartSixtyCycleYear().getYear()
    const endAge = childLimit.getEndAge()
    const startAge = childLimit.getStartAge()
    const daYunList: string[] = [`${firstYear}年（${startAge}岁）至${firstYear + (endAge - startAge)}年（${endAge}）岁`]
    const liuNianList: string[] = []
    let fortune = childLimit.getStartDecadeFortune()
    let liuNianStart: SixtyCycleYear | undefined
    let liuNianEnd: SixtyCycleYear | undefined
    const nowLunarYear = getLunarHour(Date.now()).getYear()
    let i = 0
    const daYunCount = 9
    while (i < daYunCount || (!liuNianStart && i < 20)) {
        const startSixtyCycleYear = fortune.getStartSixtyCycleYear()
        const startYear = startSixtyCycleYear.getYear()
        const endSixtyCycleYear = fortune.getEndSixtyCycleYear()
        const endYear = endSixtyCycleYear.getYear()
        if (startYear <= nowLunarYear && endYear >= nowLunarYear) {
            liuNianStart = startSixtyCycleYear
            liuNianEnd = endSixtyCycleYear
        }
        const sixtyCycle = fortune.getSixtyCycle()
        daYunList.push(
            `${startYear}年（${fortune.getStartAge()}岁）至${endYear}年（${fortune.getEndAge()}岁-${sixtyCycle.getName()}大运（${dayHeavenStem.getTenStar(sixtyCycle.getHeavenStem()).getName()}、${dayHeavenStem.getTenStar(sixtyCycle.getEarthBranch().getHideHeavenStemMain()).getName()}）`
        )
        fortune = fortune.next(1)
        i++
    }
    if (liuNianStart && liuNianEnd) {
        let curLiuNian = liuNianStart
        while (curLiuNian.getYear() <= liuNianEnd.getYear()) {
            const sixtyCycle = curLiuNian.getSixtyCycle()
            liuNianList.push(
                `${curLiuNian.getYear()} ${sixtyCycle.getName()}（${dayHeavenStem.getTenStar(sixtyCycle.getHeavenStem()).getName()}、${dayHeavenStem.getTenStar(sixtyCycle.getEarthBranch().getHideHeavenStemMain()).getName()}）`
            )
            curLiuNian = curLiuNian.next(1)
        }
    }
    return [i > daYunCount && !!liuNianStart ? daYunList.slice(-daYunCount) : daYunList.slice(0, daYunCount), liuNianList]
}

const TIAN_GAN: string[] = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
const DI_ZHI: string[] = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']

function getBaZiInfoStr(gender: UserGender, birthtime: Long): string {
    const [daYunStr, liuNianStr] = getBaziDaYunAndLiuNian(gender, birthtime)
    const eightChar = getEightCharByTime(birthtime)
    const year = eightChar.getYear()
    const yearZhi = year.getEarthBranch().getName()
    const month = eightChar.getMonth()
    const monthZhi = month.getEarthBranch().getName()
    const day = eightChar.getDay()
    const dayZhi = day.getEarthBranch().getName()
    const hour = eightChar.getHour()
    const hourZhi = hour.getEarthBranch().getName()
    const yearHideHeavenStems = year.getEarthBranch().getHideHeavenStems()
    const monthHideHeavenStems = month.getEarthBranch().getHideHeavenStems()
    const dayHideHeavenStems = day.getEarthBranch().getHideHeavenStems()
    const hourHideHeavenStems = hour.getEarthBranch().getHideHeavenStems()
    const dayHeavenStem = day.getHeavenStem()
    const yearHeavenStem = year.getHeavenStem()
    const monthHeavenStem = month.getHeavenStem()
    const hourHeavenStem = hour.getHeavenStem()
    return `天干：
年柱：${yearHeavenStem.getName()}（${dayHeavenStem.getTenStar(yearHeavenStem).getName()}）
月柱：${monthHeavenStem.getName()}（${dayHeavenStem.getTenStar(monthHeavenStem).getName()}）
日柱：${dayHeavenStem.getName()}（日主）
时柱：${hourHeavenStem.getName()}（${dayHeavenStem.getTenStar(hourHeavenStem).getName()}）
地支：
年支：${yearZhi}
月支：${monthZhi}
日支：${dayZhi}
时支：${hourZhi}
藏干：
年支（${yearZhi}）：${yearHideHeavenStems.map((it) => it.getName()).join('，')}为${yearHideHeavenStems.map((it) => dayHeavenStem.getTenStar(it.getHeavenStem()).getName()).join('，')}
月支（${monthZhi}）：${monthHideHeavenStems.map((it) => it.getName()).join('，')}为${monthHideHeavenStems.map((it) => dayHeavenStem.getTenStar(it.getHeavenStem()).getName()).join('，')}
日支（${dayZhi}）：${dayHideHeavenStems.map((it) => it.getName()).join('，')}为${dayHideHeavenStems.map((it) => dayHeavenStem.getTenStar(it.getHeavenStem()).getName()).join('，')}
时支（${hourZhi}）：${hourHideHeavenStems.map((it) => it.getName()).join('，')}为${hourHideHeavenStems.map((it) => dayHeavenStem.getTenStar(it.getHeavenStem()).getName()).join('，')}
星运：
年柱：${dayHeavenStem.getTerrain(year.getEarthBranch()).getName()}
月柱：${dayHeavenStem.getTerrain(month.getEarthBranch()).getName()}
日柱：${dayHeavenStem.getTerrain(day.getEarthBranch()).getName()}
时柱：${dayHeavenStem.getTerrain(hour.getEarthBranch()).getName()}
自坐：
年柱：${yearHeavenStem.getTerrain(year.getEarthBranch()).getName()}
月柱：${monthHeavenStem.getTerrain(month.getEarthBranch()).getName()}
日柱：${dayHeavenStem.getTerrain(day.getEarthBranch()).getName()}
时柱：${hourHeavenStem.getTerrain(hour.getEarthBranch()).getName()}
空亡：
年柱：${year
        .getExtraEarthBranches()
        .map((it) => it.getName())
        .join('')}
月柱：${month
        .getExtraEarthBranches()
        .map((it) => it.getName())
        .join('')}
日柱：${day
        .getExtraEarthBranches()
        .map((it) => it.getName())
        .join('')}
时柱：${hour
        .getExtraEarthBranches()
        .map((it) => it.getName())
        .join('')}
纳音：
年柱：${year.getSound().getName()}
月柱：${month.getSound().getName()}
日柱：${day.getSound().getName()}
时柱：${hour.getSound().getName()}
五行：
年柱：${yearHeavenStem.getElement().getName()}${year.getEarthBranch().getElement().getName()}
月柱：${monthHeavenStem.getElement().getName()}${month.getEarthBranch().getElement().getName()}
日柱：${day.getHeavenStem().getElement().getName()}${day.getEarthBranch().getElement().getName()}
时柱：${hourHeavenStem.getElement().getName()}${hour.getEarthBranch().getElement().getName()}
大运：
${daYunStr.join('\n')}
流年：
${liuNianStr.join('\n')}`
}

function getEightChar(bazi: Pick<Bazi, 'bazi_real_sun_time'>): EightChar {
    const lunar = getLunarHour(bazi.bazi_real_sun_time)
    return lunar.getEightChar()
}

function getBaziInfo(bazi: Pick<Bazi, 'bazi_real_sun_time' | 'bazi_birthday' | 'bazi_gender' | 'bazi_name'>): string {
    const eightChar = getEightChar(bazi)
    const shenSha = shenShaHelper.eightChar2ShenSha(eightChar, bazi.bazi_gender === UserGender.female ? 0 : 1)

    // 格式化公历生日（基于用户输入的生日）
    const birthday = new Date(bazi.bazi_birthday)
    const birthdayStr = `${birthday.getFullYear()}年${birthday.getMonth() + 1}月${birthday.getDate()}日 ${timeBeautifySimple(bazi.bazi_birthday)}`

    // 格式化真太阳时
    const realSunTime = new Date(bazi.bazi_real_sun_time)
    const realSunTimeStr = `${realSunTime.getFullYear()}年${realSunTime.getMonth() + 1}月${realSunTime.getDate()}日 ${timeBeautifySimple(bazi.bazi_real_sun_time)}`

    // 格式化农历生日（基于用户输入的生日，与 arrangement-page.tsx 保持一致）
    const birthLunar = getLunarHour(bazi.bazi_birthday)
    const lunarBirthdayStr = `${year2String(birthLunar.getYear())}年${convert2LunarMonth(birthLunar.getMonth())}月${lunarDays[birthLunar.getDay() - 1]} ${timeBeautifySimple(bazi.bazi_birthday)}`

    return `姓名：${bazi.bazi_name}
性别：${bazi.bazi_gender === UserGender.female ? '女' : '男'}
生日：${birthdayStr}
真太阳时：${realSunTimeStr}
农历：${lunarBirthdayStr}
${getBaZiInfoStr(bazi.bazi_gender, bazi.bazi_real_sun_time)}
神煞：
年柱：${shenSha.year.join('，')}
月柱：${shenSha.month.join('，')}
日柱：${shenSha.day.join('，')}
时柱：${shenSha.hour.join('，')}`
}

/**
 * 根据真太阳时和性别获取八字信息（不含姓名）
 * 用于特殊日等场景，只需要八字快照而不需要完整用户信息
 */
function getBaziInfoByRealSunTime(realSunTime: number, gender: UserGender): string {
    const eightChar = getEightCharByTime(realSunTime)
    const shenSha = shenShaHelper.eightChar2ShenSha(eightChar, gender === UserGender.female ? 0 : 1)
    return `性别：${gender === UserGender.female ? '女' : '男'}
${getBaZiInfoStr(gender, realSunTime)}
神煞：
年柱：${shenSha.year.join('，')}
月柱：${shenSha.month.join('，')}
日柱：${shenSha.day.join('，')}
时柱：${shenSha.hour.join('，')}`
}

function getGanZhiWuXing(dayGan: string, dayZhi: string): string {
    return `${WuXing2Name[GanInfo[dayGan].wuxing]}、${WuXing2Name[ZhiInfo[dayZhi].wuxing]}`
}

function getDayGanShiShen(eightCharGan: string, dayGan: string): string {
    const shiShenList: string[] = ['比肩', '劫财', '食神', '伤官', '偏财', '正财', '七杀', '正官', '偏印', '正印']
    const ganStr = '甲乙丙丁戊己庚辛壬癸'
    const ganStr2 = '乙甲丁丙己戊辛庚癸壬'
    const eightCharGanIndex = ganStr.indexOf(eightCharGan)
    const _ganStr = eightCharGanIndex % 2 === 1 ? ganStr2 : ganStr
    const dayGanIndex = _ganStr.indexOf(dayGan) - (eightCharGanIndex % 2 === 1 ? eightCharGanIndex - 1 : eightCharGanIndex)
    const shiShenIndex = dayGanIndex < 0 ? 10 + dayGanIndex : dayGanIndex
    return shiShenList[shiShenIndex]
}

function getGanFromShiShen(eightCharGan: string, shiShen: string): string {
    // 采用穷举验证法，遍历所有天干找到匹配的结果
    const allGan = '甲乙丙丁戊己庚辛壬癸'.split('')
    for (const g of allGan) {
        if (getDayGanShiShen(eightCharGan, g) === shiShen) {
            return g
        }
    }

    // 如果遍历所有天干都没找到匹配的十神，返回空字符串
    return ''
}

function getGenderNumber(gender: UserGender): 0 | 1 {
    return gender === UserGender.female ? 0 : 1
}

const ShiShenDetail: Array<{
    shiShen: string
    advice: string
    avoid: string
    guide: string
    description: string
}> = [
    {
        shiShen: '正官',
        advice: '遵守规则，履行职责，适合严谨处理事务、与上级沟通、求职或公职相关事宜。',
        avoid: '过于保守，墨守成规，避免因过度拘谨而错失发展机会。',
        guide: '「正官」如规矩方圆，适宜严谨行事，树立威信，但需避免拘泥于条框。',
        description:
            '克制自己的五行，且阴阳相反的是正官。正官代表秩序、规范、责任，象征社会规则的约束力。流日遇正官，人更倾向于遵守制度，强调自律和社会形象，对待事务更严谨规范。正官的力量带来组织性，利于处理事务和承担责任。',
    },
    {
        shiShen: '七杀',
        advice: '勇敢决策，迎接挑战，适合突破瓶颈、承担重要任务。',
        avoid: '急躁鲁莽，过于强势，避免因独断专行而与他人产生冲突。',
        guide: '「七杀」如烈火锻金，适宜果敢行动，但需控制冲动，避免与人正面冲突。',
        description:
            '克制自己的五行，但阴阳相同的是七杀。七杀代表权威、挑战、果敢，象征压制与竞争关系。流日遇七杀，可能带来强势的环境影响，促使人果断行动，增强应对压力的能力。七杀的特性强调决断和领导力，同时也意味着适应变化、迎接挑战的必要性。',
    },
    {
        shiShen: '正印',
        advice: '学习提升，思考沉淀，适合求学、读书、与贵人交流。',
        avoid: '依赖他人，优柔寡断，避免因过度犹豫而错失良机。',
        guide: '「正印」如春雨润物，适宜积累知识，培养智慧，但需避免因过度依赖他人而失去主动权。',
        description:
            '生助自己的五行，且阴阳相反的是正印。正印代表学识、庇护、滋养，象征智慧与保护机制。流日遇正印，人更倾向于学习、吸收新知，关注精神层面的成长，强调内在安全感的建立。正印的特性使人容易受到长辈、贵人的扶持，同时也增强了耐心与思考能力。',
    },
    {
        shiShen: '偏印',
        advice: '专注研究，保持低调，适合独立思考、探索未知领域。',
        avoid: '多疑猜忌，孤立自己，避免因情绪不稳定影响决策。',
        guide: '「偏印」如幽谷藏风，适宜深思熟虑，避开纷争，但需注意情绪稳定，避免陷入消极思维。',
        description:
            '生助自己的五行，但阴阳相同的是偏印。偏印代表直觉、神秘、独立思考，象征特殊才能与隐秘性。流日遇偏印，思维模式可能偏向独立与深度探索，容易对抽象、哲学、神秘领域产生兴趣。偏印的特性带来深刻的观察力，同时也强调了个人化的理解与解读方式。',
    },
    {
        shiShen: '比肩',
        advice: '独立思考，主动争取机会，增强自信，适合团队合作或个人突破。',
        avoid: '固执己见，过度竞争，避免与人争执或因逞强而失去机会。',
        guide: '「比肩」如劲竹立风，坚定自我，适宜果敢行事，但需警惕因过度坚持己见而与人冲突。',
        description:
            '与自己五行相同，且阴阳相同的是比肩。比肩代表自主、独立、竞争，象征个人意志的强化。流日遇比肩，人更容易专注自身事务，增强自我意识，对团队协作、伙伴关系产生直接影响。在人际互动中，比肩体现平等、合作与竞争并存的状态。',
    },
    {
        shiShen: '劫财',
        advice: '敢于挑战，勇于冒险，适合结交新朋友、谈判或资源整合。',
        avoid: '冲动行事，过于慷慨导致损失，避免不必要的财务支出。',
        guide: '「劫财」如疾风骤雨，适合打破常规，尝试新思路，但需谨慎处理财务，防止因急躁而失策。',
        description:
            '与自己五行相同，但阴阳相反的是劫财。劫财代表果敢、冒险、争夺，强调资源的重新分配。流日遇劫财，可能促使人更倾向于打破固有格局，强调个人利益的扩张，同时也容易激发社交、交易、财富流动等方面的波动。',
    },
    {
        shiShen: '食神',
        advice: '享受美食，培养兴趣，适合创意表达、社交互动、与人分享快乐。',
        avoid: '懒散拖延，沉迷娱乐，避免因过度放松而影响效率。',
        guide: '「食神」如春风拂面，心情轻松，适宜享受生活，但要注意收敛贪玩之心，以免耽误正事。',
        description:
            '被自己五行所生，且阴阳相同的是食神。食神代表才华、表达、享受，象征创造与生机。流日遇食神，思维活跃，情绪轻松，适宜表现才艺、构思计划或享受生活。食神的特性带来舒适感，同时也增强了人的包容度和创造力。',
    },
    {
        shiShen: '伤官',
        advice: '展示才华，表达创意，适合创新、策划、表达自我。',
        avoid: '口无遮拦，挑战权威，避免因情绪化或言辞过激而影响人际关系。',
        guide: '「伤官」如江水奔流，灵感涌现，适宜突破常规，但需控制锋芒，避免言辞过激。',
        description:
            '被自己五行所生，但阴阳相反的是伤官。伤官代表突破、反叛、才华外露，强调不受拘束的表达。流日遇伤官，人更容易展现个性，敢于质疑和挑战权威，带有鲜明的自主意识，适合自由发挥。伤官气质张扬，具有激发创新和突破限制的力量。',
    },
    {
        shiShen: '正财',
        advice: '理财规划，稳扎稳打，适合开展务实工作、处理财务事务。',
        avoid: '贪恋金钱，过于谨慎，避免错失投资机会或因固守旧法而不敢突破。',
        guide: '「正财」如厚土承载，适合踏实进取，积累财富，但需避免过于谨慎而错失机遇。',
        description:
            '自己所克的五行，且阴阳相反的是正财。正财代表稳定、实际、责任，强调有序的物质管理。流日遇正财，人更注重现实事务，倾向于关注资源配置、财富运作以及生活秩序的稳定。正财的特性强调专注、踏实，带有长远规划的意识。',
    },
    {
        shiShen: '偏财',
        advice: '尝试新项目，投资决策，适合交际、洽谈合作、抓住财运机遇。',
        avoid: '盲目投资，过于贪心，避免因投机心理而带来风险。',
        guide: '「偏财」如流水行商，财运浮现，适宜大胆尝试，但需留意风险，切勿盲目冒进。',
        description:
            '自己所克的五行，但阴阳相同的是偏财。偏财代表机遇、流动、灵活，象征商业直觉与财富变动。流日遇偏财，人容易关注外部资源的获取，强调投资、交易、机遇捕捉的能力。偏财的特性带有不确定性，涉及更广泛的财富流通模式。',
    },
]

/**
 * 计算两个天干之间的生克关系和阴阳关系
 * @param gan1 第一个天干，视为"我"
 * @param gan2 第二个天干
 * @returns 返回包含关系详情的对象
 */
function getGanRelationship(
    gan1: string,
    gan2: string
): {
    wuxingRelation: '五行相同' | '五行制约' | '五行生扶' | ''
    yinyangRelation: '阴阳相反' | '阴阳相同' | ''
    relation: string
    relationName: string
    direction: -1 | 0 | 1
} {
    // 获取两个天干的五行和阴阳属性
    const gan1WuXing = GanInfo[gan1].wuxing
    const gan2WuXing = GanInfo[gan2].wuxing
    const gan1YinYang = GanInfo[gan1].yinyang
    const gan2YinYang = GanInfo[gan2].yinyang

    // 判断阴阳关系
    let yinyangRelation: '阴阳相反' | '阴阳相同' | '' = ''
    if (gan1YinYang === gan2YinYang) {
        yinyangRelation = '阴阳相同'
    } else {
        yinyangRelation = '阴阳相反'
    }

    // 判断五行之间的生克关系
    // 相生规则：金生水，水生木，木生火，火生土，土生金
    // 相克规则：金克木，木克土，土克水，水克火，火克金
    let wuxingRelation: '五行相同' | '五行制约' | '五行生扶' | '' = ''
    let relation = ''
    let relationName = ''
    // -1: 克我/生我，0: 同我，1： 我克/我生
    let direction: -1 | 0 | 1 = 0

    // 判断是否为同五行
    if (gan1WuXing === gan2WuXing) {
        wuxingRelation = '五行相同'
        direction = 0
        if (gan1YinYang === gan2YinYang) {
            relation = '同我'
            relationName = '比肩'
        } else {
            relation = '同我'
            relationName = '劫财'
        }
    } else {
        // 判断是否为生关系
        const isGan1ShengGan2 =
            (gan1WuXing === WuXing.Metal && gan2WuXing === WuXing.Water) ||
            (gan1WuXing === WuXing.Water && gan2WuXing === WuXing.Wood) ||
            (gan1WuXing === WuXing.Wood && gan2WuXing === WuXing.Fire) ||
            (gan1WuXing === WuXing.Fire && gan2WuXing === WuXing.Earth) ||
            (gan1WuXing === WuXing.Earth && gan2WuXing === WuXing.Metal)

        // 判断是否为克关系
        const isGan1KeGan2 =
            (gan1WuXing === WuXing.Metal && gan2WuXing === WuXing.Wood) ||
            (gan1WuXing === WuXing.Wood && gan2WuXing === WuXing.Earth) ||
            (gan1WuXing === WuXing.Earth && gan2WuXing === WuXing.Water) ||
            (gan1WuXing === WuXing.Water && gan2WuXing === WuXing.Fire) ||
            (gan1WuXing === WuXing.Fire && gan2WuXing === WuXing.Metal)

        // 判断是否为被生关系
        const isGan2ShengGan1 =
            (gan2WuXing === WuXing.Metal && gan1WuXing === WuXing.Water) ||
            (gan2WuXing === WuXing.Water && gan1WuXing === WuXing.Wood) ||
            (gan2WuXing === WuXing.Wood && gan1WuXing === WuXing.Fire) ||
            (gan2WuXing === WuXing.Fire && gan1WuXing === WuXing.Earth) ||
            (gan2WuXing === WuXing.Earth && gan1WuXing === WuXing.Metal)

        // 判断是否为被克关系
        const isGan2KeGan1 =
            (gan2WuXing === WuXing.Metal && gan1WuXing === WuXing.Wood) ||
            (gan2WuXing === WuXing.Wood && gan1WuXing === WuXing.Earth) ||
            (gan2WuXing === WuXing.Earth && gan1WuXing === WuXing.Water) ||
            (gan2WuXing === WuXing.Water && gan1WuXing === WuXing.Fire) ||
            (gan2WuXing === WuXing.Fire && gan1WuXing === WuXing.Metal)

        if (isGan1ShengGan2) {
            wuxingRelation = '五行生扶'
            direction = 1
            if (gan1YinYang === gan2YinYang) {
                relation = '我生'
                relationName = '偏财'
            } else {
                relation = '我生'
                relationName = '正财'
            }
        } else if (isGan1KeGan2) {
            wuxingRelation = '五行制约'
            direction = 1
            if (gan1YinYang === gan2YinYang) {
                relation = '我克'
                relationName = '食神'
            } else {
                relation = '我克'
                relationName = '伤官'
            }
        } else if (isGan2ShengGan1) {
            wuxingRelation = '五行生扶'
            direction = -1
            if (gan1YinYang === gan2YinYang) {
                relation = '生我'
                relationName = '偏印'
            } else {
                relation = '生我'
                relationName = '正印'
            }
        } else if (isGan2KeGan1) {
            wuxingRelation = '五行制约'
            direction = -1
            if (gan1YinYang === gan2YinYang) {
                relation = '克我'
                relationName = '七杀'
            } else {
                relation = '克我'
                relationName = '正官'
            }
        }
    }

    return {
        wuxingRelation,
        yinyangRelation,
        relation,
        relationName,
        direction,
    }
}

export default {
    getBaZiInfoStr: getBaZiInfoStr,
    getBaziDaYunAndLiuNian: getBaziDaYunAndLiuNian,
    getBaziInfo: getBaziInfo,
    getBaziInfoByRealSunTime: getBaziInfoByRealSunTime,
    getGanZhiWuXing: getGanZhiWuXing,
    getDayGanShiShen: getDayGanShiShen,
    getGanFromShiShen: getGanFromShiShen,
    getEightChar: getEightChar,
    getGenderNumber: getGenderNumber,
    getGanRelationship: getGanRelationship,
    getSolarTime: getSolarTime,
    getLunarHour: getLunarHour,
    getEightCharByTime: getEightCharByTime,
    getGender: getGender,

    ShiShenDetail,
}
