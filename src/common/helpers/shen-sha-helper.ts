import '../utils/array-extensions'
import { EightChar } from 'tyme4ts'

interface BaziSiZhu {
    yearGan: string
    yearZhi: string
    monthGan: string
    monthZhi: string
    dayGan: string
    dayZhi: string
    hourGan: string
    hourZhi: string
}

interface NaYin {
    yearNaYin: string
    monthNaYin: string
    dayNaYin: string
    hourNaYin: string
}

type RuleResult = [boolean, boolean, boolean, boolean]

const ruleAllFalseResult: RuleResult = [false, false, false, false]

function ruleCheckGan(
    rule: string | undefined,
    siZhu: BaziSiZhu,
    name: string
): [RuleResult, string] {
    const { yearGan, hourGan, dayGan, monthGan, } = siZhu
    if (!rule) {
        console.error('规则异常：', name, siZhu)
        return [ruleAllFalseResult, name]
    }
    return [[
        yearGan === rule,
        monthGan === rule,
        dayGan === rule,
        hourGan === rule,
    ], name]
}

function ruleCheckGanZhi(
    rule: string | undefined,
    siZhu: BaziSiZhu,
    name: string
): [RuleResult, string] {
    const { yearGan, hourGan, dayGan, monthGan, yearZhi, hourZhi, dayZhi, monthZhi, } = siZhu
    if (!rule) {
        console.error('规则异常：', name, siZhu)
        return [ruleAllFalseResult, name]
    }
    return [[
        yearGan === rule || yearZhi === rule,
        monthGan === rule || monthZhi === rule,
        dayGan === rule || dayZhi === rule,
        hourGan === rule || hourZhi === rule,
    ], name]
}

const shenShaRules: Array<(siZhu: BaziSiZhu, naYin: NaYin, sex: 0 | 1) => [RuleResult, string]> = [
    ({ dayGan, yearGan, dayZhi, hourZhi, monthZhi, yearZhi }) => {
        const name = '天乙贵人'
        const rules: Array<{
            gan: Array<string>
            zhi: Array<string>
        }> = [{
            gan: ['甲', '庚'],
            zhi: ['丑', '未']
        }, {
            gan: ['乙', '己'],
            zhi: ['子', '申']
        }, {
            gan: ['丙', '丁'],
            zhi: ['酉', '亥'],
        }, {
            gan: ['辛', '戊'],
            zhi: ['寅', '午']
        }, {
            gan: ['壬', '癸'],
            zhi: ['巳', '卯']
        }]
        const rulesZhi = rules.mapNotNull(rule => {
            if (rule.gan.includes(yearGan) || rule.gan.includes(dayGan)) {
                return rule.zhi
            }
            return undefined
        }).flatten()
        return [[
            rulesZhi.includes(yearZhi),
            rulesZhi.includes(monthZhi),
            rulesZhi.includes(dayZhi),
            rulesZhi.includes(hourZhi),
        ], name]
    },
    (siZhu) => {
        const name = '天德贵人'
        const rules: [string, string][] = [
            ['寅', '丁'],
            ['卯', '申'],
            ['辰', '壬'],
            ['巳', '辛'],
            ['午', '亥'],
            ['未', '甲'],
            ['申', '癸'],
            ['酉', '寅'],
            ['戌', '丙'],
            ['亥', '乙'],
            ['子', '巳'],
            ['丑', '庚'],
        ]
        const rule = rules.find(([z]) => z === siZhu.monthZhi)?.[1]
        return ruleCheckGan(rule, siZhu, name)
    },
    (siZhu) => {
        const name = '月德贵人'
        const rules: Array<{
            zhi: string[]
            gan: string
        }> = [{
            zhi: ['寅', '午', '戌'],
            gan: '丙',
        }, {
            zhi: ['申', '子', '辰'],
            gan: '壬',
        }, {
            zhi: ['亥', '卯', '未'],
            gan: '甲',
        }, {
            zhi: ['巳', '酉', '丑'],
            gan: '庚',
        },]
        const rule = rules.find(({ zhi }) => zhi.includes(siZhu.monthZhi))?.gan
        return ruleCheckGan(rule, siZhu, name)
    },
    (siZhu) => {
        const name = '天德合'
        const rules: [string, string][] = [
            ['寅', '壬'],
            ['卯', '巳'],
            ['辰', '丁'],
            ['巳', '丙'],
            ['午', '寅'],
            ['未', '己'],
            ['申', '戊'],
            ['酉', '亥'],
            ['戌', '辛'],
            ['亥', '庚'],
            ['子', '申'],
            ['丑', '乙'],
        ]
        const rule = rules.find(([z]) => z === siZhu.monthZhi)?.[1]
        return ruleCheckGanZhi(rule, siZhu, name)
    },
    (siZhu) => {
        const name = '月德合'
        const rules: Array<{
            zhi: string[]
            gan: string
        }> = [{
            zhi: ['寅', '午', '戌'],
            gan: '辛',
        }, {
            zhi: ['申', '子', '辰'],
            gan: '丁',
        }, {
            zhi: ['亥', '卯', '未'],
            gan: '己',
        }, {
            zhi: ['巳', '酉', '丑'],
            gan: '乙',
        },]
        const rule = rules.find(({ zhi }) => zhi.includes(siZhu.monthZhi))?.gan
        return ruleCheckGan(rule, siZhu, name)
    },
    (siZhu) => {
        const name = '天赦日'
        const { monthZhi, dayGan, dayZhi } = siZhu
        const rules: Array<{
            month: string[]
            day: string[]
        }> = [{
            month: ['寅', '卯', '辰'],
            day: ['戊', '寅']
        }, {
            month: ['巳', '午', '未'],
            day: ['甲', '午']
        }, {
            month: ['申', '酉', '戌'],
            day: ['戊', '申']
        }, {
            month: ['亥', '子', '丑'],
            day: ['甲', '子']
        },]
        const rule = rules.find(({ month }) => month.includes(monthZhi))?.day
        if (!rule) {
            console.error('规则异常：', name, siZhu)
            return [ruleAllFalseResult, name]
        }
        return [[
            false,
            false,
            rule.includes(dayGan) && rule.includes(dayZhi),
            false
        ], name]
    },
    (siZhu) => {
        const name = '禄神'
        const rules: Array<{
            gan: string
            zhi: string
        }> = [
            { gan: '甲', zhi: '寅' },
            { gan: '乙', zhi: '卯' },
            { gan: '丙', zhi: '巳' },
            { gan: '丁', zhi: '午' },
            { gan: '戊', zhi: '巳' },
            { gan: '己', zhi: '己' },
            { gan: '庚', zhi: '申' },
            { gan: '辛', zhi: '酉' },
            { gan: '壬', zhi: '亥' },
            { gan: '癸', zhi: '子' },
        ]
        const { dayGan, yearZhi, hourZhi, dayZhi, monthZhi, } = siZhu
        const rule = rules.find(({ gan }) => gan === dayGan)?.zhi
        if (!rule) {
            console.error('规则异常：', name, siZhu)
            return [ruleAllFalseResult, name]
        }
        return [[
            rule === yearZhi,
            rule === monthZhi,
            rule === dayZhi,
            rule === hourZhi,
        ], name]
    },
    (siZhu) => {
        const name = '驿马'
        const rules: Array<{
            zhi: Array<string>
            ruleZhi: string
        }> = [{
            zhi: ['申', '子', '辰'],
            ruleZhi: '寅',
        }, {
            zhi: ['寅', '午', '戌'],
            ruleZhi: '申',
        }, {
            zhi: ['巳', '酉', '丑'],
            ruleZhi: '亥',
        }, {
            zhi: ['亥', '卯', '未'],
            ruleZhi: '巳',
        },]
        const { dayZhi, monthZhi, yearZhi, hourZhi, } = siZhu
        const yearRuleZhi = rules.find(({ zhi }) => zhi.includes(yearZhi))?.ruleZhi
        const dayRuleZhi = rules.find(({ zhi }) => zhi.includes(dayZhi))?.ruleZhi
        if (!yearRuleZhi || !dayRuleZhi) {
            console.error('规则异常', name, siZhu)
            return [ruleAllFalseResult, name]
        }
        return [[
            dayRuleZhi === yearZhi,
            dayRuleZhi === monthZhi || yearRuleZhi === monthZhi,
            yearRuleZhi === dayZhi,
            dayRuleZhi === hourZhi || yearRuleZhi === hourZhi,
        ], name]
    },
    (siZhu) => {
        const name = '太极贵人'
        const rules: Array<{
            gan: string[]
            zhi: string[]
        }> = [{
            gan: ['甲', '乙'],
            zhi: ['午', '子'],
        }, {
            gan: ['丙', '丁'],
            zhi: ['卯', '酉'],
        }, {
            gan: ['戊', '己'],
            zhi: ['辰', '戌', '丑', '未',],
        }, {
            gan: ['庚', '辛'],
            zhi: ['寅', '亥'],
        }, {
            gan: ['壬', '癸'],
            zhi: ['申', '巳'],
        },]
        const yearGanRule = rules.find(({ gan }) => gan.includes(siZhu.yearGan))?.zhi
        const dayGanRule = rules.find(({ gan }) => gan.includes(siZhu.dayGan))?.zhi
        if (!yearGanRule || !dayGanRule) {
            console.error('规则异常', name, siZhu)
            return [ruleAllFalseResult, name]
        }
        return [[
            yearGanRule.includes(siZhu.yearZhi) || dayGanRule.includes(siZhu.yearZhi),
            yearGanRule.includes(siZhu.monthZhi) || dayGanRule.includes(siZhu.monthZhi),
            yearGanRule.includes(siZhu.dayZhi) || dayGanRule.includes(siZhu.dayZhi),
            yearGanRule.includes(siZhu.hourZhi) || dayGanRule.includes(siZhu.hourZhi),
        ], name]
    },
    (siZhu) => {
        const name = '将星'
        const rules: Array<{
            zhi: string
            ruleZhi: string
        }> = [
            { zhi: '子', ruleZhi: '子' },
            { zhi: '丑', ruleZhi: '酉' },
            { zhi: '寅', ruleZhi: '午' },
            { zhi: '卯', ruleZhi: '卯' },
            { zhi: '辰', ruleZhi: '子' },
            { zhi: '巳', ruleZhi: '酉' },
            { zhi: '午', ruleZhi: '午' },
            { zhi: '未', ruleZhi: '卯' },
            { zhi: '申', ruleZhi: '子' },
            { zhi: '酉', ruleZhi: '酉' },
            { zhi: '戌', ruleZhi: '午' },
            { zhi: '亥', ruleZhi: '卯' },
        ]
        const yearRuleZhi = rules.find(({ zhi }) => zhi === siZhu.yearZhi)?.ruleZhi
        const dayRuleZhi = rules.find(({ zhi }) => zhi === siZhu.dayZhi)?.ruleZhi
        if (!yearRuleZhi || !dayRuleZhi) {
            console.error('规则异常', name, siZhu)
            return [ruleAllFalseResult, name]
        }
        return [[
            dayRuleZhi === siZhu.yearZhi,
            dayRuleZhi === siZhu.monthZhi || yearRuleZhi === siZhu.monthZhi,
            yearRuleZhi === siZhu.dayZhi,
            dayRuleZhi === siZhu.hourZhi || yearRuleZhi === siZhu.hourZhi,
        ], name]
    },
    (siZhu, naYin) => {
        const name = '学堂'
        const rules: Array<{
            yearNaYin: string
            zhi: string
        }> = [
            { yearNaYin: '金', zhi: '巳' },
            { yearNaYin: '木', zhi: '亥' },
            { yearNaYin: '水', zhi: '申' },
            { yearNaYin: '土', zhi: '申' },
            { yearNaYin: '火', zhi: '寅' },
        ]
        return ruleCheckNaYinNotYearZhi(rules, siZhu, naYin, name)
    },
    (siZhu, naYin) => {
        const name = '词馆'
        const rules: Array<{
            yearNaYin: string
            zhi: string
        }> = [
            { yearNaYin: '金', zhi: '申' },
            { yearNaYin: '木', zhi: '寅' },
            { yearNaYin: '水', zhi: '亥' },
            { yearNaYin: '土', zhi: '亥' },
            { yearNaYin: '火', zhi: '巳' },
        ]
        return ruleCheckNaYinNotYearZhi(rules, siZhu, naYin, name)
    },
    (siZhu) => {
        const name = '国印'
        const rules: Array<{
            gan: string
            zhi: string
        }> = [
            { gan: '甲', zhi: '戌' },
            { gan: '乙', zhi: '亥' },
            { gan: '丙', zhi: '丑' },
            { gan: '丁', zhi: '寅' },
            { gan: '戊', zhi: '丑' },
            { gan: '己', zhi: '寅' },
            { gan: '庚', zhi: '辰' },
            { gan: '辛', zhi: '巳' },
            { gan: '壬', zhi: '未' },
            { gan: '癸', zhi: '申' },
        ]
        return dayYearGanCheckZhi(rules, siZhu, name)
    },
    (siZhu) => {
        const name = '三奇贵人'
        const rules = ['甲戊庚', '乙丙丁', '壬癸辛']
        const { dayGan, yearGan, hourGan, monthGan, } = siZhu
        const gan1 = yearGan + monthGan + dayGan
        const gan2 = monthGan + dayGan + hourGan
        if (rules.includes(gan1)) {
            return [[true, true, true, false], name]
        } else if (rules.includes(gan2)) {
            return [[false, true, true, true], name]
        }
        return [ruleAllFalseResult, name]
    },
    (siZhu) => {
        const name = '文昌贵人'
        const rules: Array<{
            gan: string
            zhi: string
        }> = [
            { gan: '甲', zhi: '巳' },
            { gan: '乙', zhi: '午' },
            { gan: '丙', zhi: '申' },
            { gan: '丁', zhi: '酉' },
            { gan: '戊', zhi: '申' },
            { gan: '己', zhi: '寅' },
            { gan: '庚', zhi: '亥' },
            { gan: '辛', zhi: '子' },
            { gan: '壬', zhi: '寅' },
            { gan: '癸', zhi: '卯' },
        ]
        return dayYearGanCheckZhi(rules, siZhu, name)
    },
    (siZhu) => {
        const name = '华盖'
        const rules: Array<{
            zhi: Array<string>
            ruleZhi: string
        }> = [{
            zhi: ['寅', '午', '戌'],
            ruleZhi: '戌',
        }, {
            zhi: ['亥', '卯', '未'],
            ruleZhi: '未',
        }, {
            zhi: ['申', '子', '辰'],
            ruleZhi: '辰',
        }, {
            zhi: ['巳', '酉', '丑'],
            ruleZhi: '丑',
        },]
        const yearRuleZhi = rules.find(({ zhi }) => zhi.includes(siZhu.yearZhi))?.ruleZhi
        const dayRuleZhi = rules.find(({ zhi }) => zhi.includes(siZhu.dayZhi))?.ruleZhi
        if (!yearRuleZhi || !dayRuleZhi) {
            console.error('规则异常', name, siZhu)
            return [ruleAllFalseResult, name]
        }
        return [[
            dayRuleZhi === siZhu.yearZhi,
            yearRuleZhi === siZhu.monthZhi || dayRuleZhi === siZhu.monthZhi,
            yearRuleZhi === siZhu.dayZhi,
            yearRuleZhi === siZhu.hourZhi || dayRuleZhi === siZhu.hourZhi,
        ], name]
    },
    (siZhu) => {
        const name = '天医'
        const rules: Array<{
            zhi: string
            ruleZhi: string
        }> = [
            { zhi: '寅', ruleZhi: '丑' },
            { zhi: '卯', ruleZhi: '寅' },
            { zhi: '辰', ruleZhi: '卯' },
            { zhi: '巳', ruleZhi: '辰' },
            { zhi: '午', ruleZhi: '巳' },
            { zhi: '未', ruleZhi: '午' },
            { zhi: '申', ruleZhi: '未' },
            { zhi: '酉', ruleZhi: '申' },
            { zhi: '戌', ruleZhi: '酉' },
            { zhi: '亥', ruleZhi: '戌' },
            { zhi: '子', ruleZhi: '亥' },
            { zhi: '丑', ruleZhi: '子' },
        ]
        const rule = rules.find(({ zhi }) => zhi === siZhu.monthZhi)?.ruleZhi
        if (!rule) {
            console.error('规则异常', name, siZhu)
            return [ruleAllFalseResult, name]
        }
        return [[
            rule === siZhu.yearZhi,
            false,
            rule === siZhu.dayZhi,
            rule === siZhu.hourZhi,
        ], name]
    },
    (siZhu) => {
        const name = '金舆'
        const rules: Array<{
            gan: string
            zhi: string
        }> = [
            { gan: '甲', zhi: '辰' },
            { gan: '乙', zhi: '巳' },
            { gan: '丙', zhi: '未' },
            { gan: '丁', zhi: '申' },
            { gan: '戊', zhi: '未' },
            { gan: '己', zhi: '申' },
            { gan: '庚', zhi: '戌' },
            { gan: '辛', zhi: '亥' },
            { gan: '壬', zhi: '丑' },
            { gan: '癸', zhi: '寅' },
        ]
        return dayYearGanCheckZhi(rules, siZhu, name)
    },
    (siZhu) => {
        const name = '空亡'
        const rules: Array<{
            zhu: string
            zhi: Array<string>
        }> = [
            { zhu: '甲子', zhi: ['戌', '亥'] },
            { zhu: '甲戌', zhi: ['申', '酉'] },
            { zhu: '甲申', zhi: ['午', '未'] },
            { zhu: '甲午', zhi: ['辰', '巳'] },
            { zhu: '甲辰', zhi: ['寅', '卯'] },
            { zhu: '甲寅', zhi: ['子', '丑'] },
        ]
        const yearRuleZhi = rules.find(({ zhu }) => zhu === (siZhu.yearGan + siZhu.yearZhi))?.zhi ?? []
        const dayRuleZhi = rules.find(({ zhu }) => zhu === (siZhu.dayGan + siZhu.dayZhi))?.zhi ?? []
        return [[
            dayRuleZhi.includes(siZhu.yearZhi),
            yearRuleZhi.includes(siZhu.monthZhi) || dayRuleZhi.includes(siZhu.monthZhi),
            yearRuleZhi.includes(siZhu.dayZhi),
            yearRuleZhi.includes(siZhu.hourZhi) || dayRuleZhi.includes(siZhu.hourZhi),
        ], name]
    },
    (siZhu) => {
        const name = '灾煞'
        const rules: Array<{
            zhi: Array<string>
            ruleZhi: string
        }> = [
            { zhi: ['申', '子', '辰'], ruleZhi: '午' },
            { zhi: ['亥', '卯', '未'], ruleZhi: '酉' },
            { zhi: ['寅', '午', '戌'], ruleZhi: '子' },
            { zhi: ['巳', '酉', '丑'], ruleZhi: '卯' },
        ]
        return yearZhiCheckOtherZhi(rules, siZhu, name)
    },
    (siZhu) => {
        const name = '劫煞'
        const rules: Array<{
            zhi: Array<string>
            ruleZhi: string
        }> = [
            { zhi: ['寅', '午', '戌'], ruleZhi: '亥' },
            { zhi: ['申', '子', '辰'], ruleZhi: '巳' },
            { zhi: ['巳', '酉', '丑'], ruleZhi: '寅' },
            { zhi: ['亥', '卯', '未'], ruleZhi: '申' },
        ]
        return dayYearZhiCheckOtherZhi(rules, siZhu, name)
    },
    (siZhu) => {
        const name = '亡神'
        const rules: Array<{
            zhi: Array<string>
            ruleZhi: string
        }> = [
            { zhi: ['寅', '午', '戌'], ruleZhi: '巳' },
            { zhi: ['亥', '卯', '未'], ruleZhi: '寅' },
            { zhi: ['巳', '酉', '丑'], ruleZhi: '申' },
            { zhi: ['申', '子', '辰'], ruleZhi: '亥' },
        ]
        return dayYearZhiCheckOtherZhi(rules, siZhu, name)
    },
    (siZhu) => {
        const name = '羊刃'
        const rules: Array<{
            gan: string
            zhi: string
        }> = [
            { gan: '甲', zhi: '卯' },
            { gan: '乙', zhi: '寅' },
            { gan: '丙', zhi: '午' },
            { gan: '丁', zhi: '巳' },
            { gan: '戊', zhi: '午' },
            { gan: '己', zhi: '巳' },
            { gan: '庚', zhi: '酉' },
            { gan: '辛', zhi: '申' },
            { gan: '壬', zhi: '子' },
            { gan: '癸', zhi: '亥' },
        ]
        return dayGanCheckZhi(rules, siZhu, name)
    },
    (siZhu) => {
        const name = '飞刃'
        const rules: Array<{
            gan: string
            zhi: string
        }> = [
            { gan: '甲', zhi: '酉' },
            { gan: '乙', zhi: '申' },
            { gan: '丙', zhi: '子' },
            { gan: '丁', zhi: '亥' },
            { gan: '戊', zhi: '子' },
            { gan: '己', zhi: '亥' },
            { gan: '庚', zhi: '卯' },
            { gan: '辛', zhi: '寅' },
            { gan: '壬', zhi: '午' },
            { gan: '癸', zhi: '巳' },
        ]
        return dayGanCheckZhi(rules, siZhu, name)
    },
    (siZhu) => {
        const name = '血刃'
        const rules: Array<{
            zhi: string
            ruleZhi: string
        }> = [
            { zhi: '寅', ruleZhi: '丑' },
            { zhi: '卯', ruleZhi: '未' },
            { zhi: '辰', ruleZhi: '寅' },
            { zhi: '巳', ruleZhi: '申' },
            { zhi: '午', ruleZhi: '卯' },
            { zhi: '未', ruleZhi: '酉' },
            { zhi: '申', ruleZhi: '辰' },
            { zhi: '酉', ruleZhi: '戌' },
            { zhi: '戌', ruleZhi: '巳' },
            { zhi: '子', ruleZhi: '午' },
            { zhi: '亥', ruleZhi: '亥' },
            { zhi: '丑', ruleZhi: '子' },
        ]
        const rule = rules.find(({ zhi }) => zhi === siZhu.monthZhi)?.ruleZhi
        if (!rule) {
            console.error('规则异常', name, siZhu)
            return [ruleAllFalseResult, name]
        }
        return [[
            siZhu.yearZhi === rule,
            false,
            siZhu.dayZhi === rule,
            siZhu.hourZhi === rule,
        ], name]
    },
    (siZhu) => {
        const name = '流霞'
        const rules: Array<{
            gan: string
            zhi: string
        }> = [
            { gan: '甲', zhi: '酉' },
            { gan: '乙', zhi: '戌' },
            { gan: '丙', zhi: '未' },
            { gan: '丁', zhi: '申' },
            { gan: '戊', zhi: '巳' },
            { gan: '己', zhi: '午' },
            { gan: '庚', zhi: '辰' },
            { gan: '辛', zhi: '卯' },
            { gan: '壬', zhi: '亥' },
            { gan: '癸', zhi: '寅' },
        ]
        return dayGanCheckZhi(rules, siZhu, name)
    },
    (siZhu) => {
        const name = '四废日'
        const rules: string[] = [
            '庚申',
            '辛酉',
            '壬子',
            '癸亥',
            '甲寅',
            '乙卯',
            '丙午',
            '丁巳',
        ]
        const zhu = siZhu.dayGan + siZhu.dayZhi
        return [[
            false,
            false,
            rules.includes(zhu),
            false
        ], name]
    },
    (siZhu) => {
        const name = '天罗地网'
        const rules: Array<{
            zhi: Array<string>
            ruleZhi: string
        }> = [
            { zhi: ['戌'], ruleZhi: '亥' },
            { zhi: ['辰'], ruleZhi: '巳' },
            { zhi: ['亥'], ruleZhi: '戌' },
            { zhi: ['巳'], ruleZhi: '辰' },
        ]
        return dayYearZhiCheckOtherZhi(rules, siZhu, name, true)
    },
    (siZhu) => {
        const name = '桃花'
        const rules: Array<{
            zhi: Array<string>
            ruleZhi: string
        }> = [
            { zhi: ['申', '子', '辰'], ruleZhi: '酉' },
            { zhi: ['寅', '午', '戌'], ruleZhi: '卯' },
            { zhi: ['巳', '酉', '丑'], ruleZhi: '午' },
            { zhi: ['亥', '卯', '未'], ruleZhi: '子' },
        ]
        return dayYearZhiCheckOtherZhi(rules, siZhu, name)
    },
    (siZhu) => {
        const name = '孤辰'
        const rules: Array<{
            zhi: Array<string>
            ruleZhi: string
        }> = [
            { zhi: ['亥', '子', '丑'], ruleZhi: '寅' },
            { zhi: ['寅', '卯', '辰'], ruleZhi: '巳' },
            { zhi: ['巳', '午', '未'], ruleZhi: '申' },
            { zhi: ['申', '酉', '戌'], ruleZhi: '亥' },
        ]
        return yearZhiCheckOtherZhi(rules, siZhu, name)
    },
    (siZhu) => {
        const name = '寡宿'
        const rules: Array<{
            zhi: Array<string>
            ruleZhi: string
        }> = [
            { zhi: ['亥', '子', '丑'], ruleZhi: '戌' },
            { zhi: ['寅', '卯', '辰'], ruleZhi: '丑' },
            { zhi: ['巳', '午', '未'], ruleZhi: '辰' },
            { zhi: ['申', '酉', '戌'], ruleZhi: '未' },
        ]
        return yearZhiCheckOtherZhi(rules, siZhu, name)
    },
    (siZhu) => {
        const name = '阴差阳错'
        const rules: Array<string> = [
            '丙子',
            '丙午',
            '丁丑',
            '丁未',
            '戊寅',
            '戊申',
            '辛卯',
            '辛酉',
            '壬辰',
            '壬戌',
            '癸巳',
            '癸亥',
        ]
        const zhu = siZhu.dayGan + siZhu.dayZhi
        return [[
            false,
            false,
            rules.includes(zhu),
            false
        ], name]
    },
    (siZhu) => {
        const name = '魁罡'
        const rules: Array<string> = [
            '戊戌',
            '庚辰',
            '庚戌',
            '壬辰',
        ]
        const zhu = siZhu.dayGan + siZhu.dayZhi
        return [[
            false,
            false,
            rules.includes(zhu),
            false
        ], name]
    },
    (siZhu) => {
        const name = '孤鸾煞'
        const rules: Array<string> = [
            '甲寅',
            '乙巳',
            '丙午',
            '丁巳',
            '戊午',
            '戊申',
            '辛亥',
            '壬子',
        ]
        const zhu = siZhu.dayGan + siZhu.dayZhi
        return [[
            false,
            false,
            rules.includes(zhu),
            false
        ], name]
    },
    (siZhu) => {
        const name = '红鸾'
        const rules: Array<{
            zhi: string
            ruleZhi: string
        }> = [
            { zhi: '子', ruleZhi: '卯' },
            { zhi: '丑', ruleZhi: '寅' },
            { zhi: '寅', ruleZhi: '丑' },
            { zhi: '卯', ruleZhi: '子' },
            { zhi: '辰', ruleZhi: '亥' },
            { zhi: '巳', ruleZhi: '戌' },
            { zhi: '午', ruleZhi: '酉' },
            { zhi: '未', ruleZhi: '申' },
            { zhi: '申', ruleZhi: '未' },
            { zhi: '酉', ruleZhi: '午' },
            { zhi: '戌', ruleZhi: '巳' },
            { zhi: '亥', ruleZhi: '辰' },
        ]
        return yearZhiCheckOtherZhi(rules, siZhu, name)
    },
    (siZhu) => {
        const name = '天喜'
        const rules: Array<{
            zhi: string
            ruleZhi: string
        }> = [
            { zhi: '子', ruleZhi: '酉' },
            { zhi: '丑', ruleZhi: '申' },
            { zhi: '寅', ruleZhi: '未' },
            { zhi: '卯', ruleZhi: '午' },
            { zhi: '辰', ruleZhi: '巳' },
            { zhi: '巳', ruleZhi: '辰' },
            { zhi: '午', ruleZhi: '卯' },
            { zhi: '未', ruleZhi: '寅' },
            { zhi: '申', ruleZhi: '丑' },
            { zhi: '酉', ruleZhi: '子' },
            { zhi: '戌', ruleZhi: '亥' },
            { zhi: '亥', ruleZhi: '戌' },
        ]
        return yearZhiCheckOtherZhi(rules, siZhu, name)
    },
    (siZhu) => {
        const name = '勾绞煞'
        const rules: Array<{
            zhi: string
            ruleZhi: string
        }> = [
            { zhi: '子', ruleZhi: '卯' },
            { zhi: '丑', ruleZhi: '辰' },
            { zhi: '寅', ruleZhi: '巳' },
            { zhi: '卯', ruleZhi: '午' },
            { zhi: '辰', ruleZhi: '未' },
            { zhi: '巳', ruleZhi: '申' },
            { zhi: '午', ruleZhi: '酉' },
            { zhi: '未', ruleZhi: '戌' },
            { zhi: '申', ruleZhi: '亥' },
            { zhi: '酉', ruleZhi: '子' },
            { zhi: '戌', ruleZhi: '丑' },
            { zhi: '亥', ruleZhi: '寅' },
        ]
        return yearZhiCheckOtherZhi(rules, siZhu, name)
    },
    (siZhu) => {
        const name = '红艳煞'
        const rules: Array<{
            gan: string
            zhi: string
        }> = [
            { gan: '甲', zhi: '午' },
            { gan: '乙', zhi: '午' },
            { gan: '丙', zhi: '寅' },
            { gan: '丁', zhi: '未' },
            { gan: '戊', zhi: '辰' },
            { gan: '己', zhi: '辰' },
            { gan: '庚', zhi: '戌' },
            { gan: '辛', zhi: '酉' },
            { gan: '壬', zhi: '子' },
            { gan: '癸', zhi: '申' },
        ]
        return dayGanCheckZhi(rules, siZhu, name)
    },
    (siZhu) => {
        const name = '十恶大败'
        const rules: Array<string> = [
            '甲辰',
            '乙巳',
            '壬申',
            '丙申',
            '丁亥',
            '庚辰',
            '戊戍',
            '癸亥',
            '辛巳',
            '己丑',
        ]
        const zhu = siZhu.dayGan + siZhu.dayZhi
        return [[
            false,
            false,
            rules.includes(zhu),
            false
        ], name]
    },
    (siZhu, _, sex) => {
        const name = '元辰'
        const yinYang = ['甲', '丙', '戊', '庚', '壬'].includes(siZhu.yearGan) ? 1 : 0
        const rules1: Array<{//阳男阴女
            zhi: string
            ruleZhi: string
        }> = [
            { zhi: '子', ruleZhi: '未' },
            { zhi: '丑', ruleZhi: '申' },
            { zhi: '寅', ruleZhi: '酉' },
            { zhi: '卯', ruleZhi: '戌' },
            { zhi: '辰', ruleZhi: '亥' },
            { zhi: '巳', ruleZhi: '子' },
            { zhi: '午', ruleZhi: '丑' },
            { zhi: '未', ruleZhi: '寅' },
            { zhi: '申', ruleZhi: '卯' },
            { zhi: '酉', ruleZhi: '辰' },
            { zhi: '戌', ruleZhi: '巳' },
            { zhi: '亥', ruleZhi: '午' },
        ]
        const rules2: Array<{//阴男阳女
            zhi: string
            ruleZhi: string
        }> = [
            { zhi: '子', ruleZhi: '巳' },
            { zhi: '丑', ruleZhi: '午' },
            { zhi: '寅', ruleZhi: '未' },
            { zhi: '卯', ruleZhi: '申' },
            { zhi: '辰', ruleZhi: '酉' },
            { zhi: '巳', ruleZhi: '戌' },
            { zhi: '午', ruleZhi: '亥' },
            { zhi: '未', ruleZhi: '子' },
            { zhi: '申', ruleZhi: '丑' },
            { zhi: '酉', ruleZhi: '寅' },
            { zhi: '戌', ruleZhi: '卯' },
            { zhi: '亥', ruleZhi: '辰' },
        ]
        const rules = (yinYang && sex) || (!yinYang && !sex) ? rules1 : rules2
        return yearZhiCheckOtherZhi(rules, siZhu, name)
    },
    (siZhu) => {
        const name = '金神'
        const rules: string[] = ['乙丑', '己巳', '癸酉']
        const dayZhu = siZhu.dayGan + siZhu.dayZhi
        const hourZhu = siZhu.hourGan + siZhu.hourZhi
        return [[
            false,
            false,
            rules.includes(dayZhu),
            rules.includes(hourZhu),
        ], name]
    },
    (siZhu) => {
        const name = '天转'
        const rules: Array<{
            zhi: Array<string>
            zhu: string
        }> = [
            { zhi: ['寅', '卯', '辰'], zhu: '乙卯' },
            { zhi: ['巳', '午', '未'], zhu: '丙午' },
            { zhi: ['申', '酉', '戌'], zhu: '辛酉' },
            { zhi: ['亥', '子', '丑'], zhu: '壬子' },
        ]
        return monthZhiCheckDayZhu(rules, siZhu, name)
    },
    (siZhu) => {
        const name = '地转'
        const rules: Array<{
            zhi: Array<string>
            zhu: string
        }> = [
            { zhi: ['寅', '卯', '辰'], zhu: '辛卯' },
            { zhi: ['巳', '午', '未'], zhu: '戊午' },
            { zhi: ['申', '酉', '戌'], zhu: '癸酉' },
            { zhi: ['亥', '子', '丑'], zhu: '丙子' },
        ]
        return monthZhiCheckDayZhu(rules, siZhu, name)
    },
    (siZhu) => {
        const name = '丧门'
        const rules: Array<{
            zhi: string
            ruleZhi: string
        }> = [
            { zhi: '子', ruleZhi: '寅' },
            { zhi: '丑', ruleZhi: '卯' },
            { zhi: '寅', ruleZhi: '辰' },
            { zhi: '卯', ruleZhi: '巳' },
            { zhi: '辰', ruleZhi: '午' },
            { zhi: '巳', ruleZhi: '未' },
            { zhi: '午', ruleZhi: '申' },
            { zhi: '未', ruleZhi: '酉' },
            { zhi: '申', ruleZhi: '戌' },
            { zhi: '酉', ruleZhi: '亥' },
            { zhi: '戌', ruleZhi: '子' },
            { zhi: '亥', ruleZhi: '丑' },
        ]
        return yearZhiCheckOtherZhi(rules, siZhu, name)
    },
    (siZhu) => {
        const name = '吊客'
        const rules: Array<{
            zhi: string
            ruleZhi: string
        }> = [
            { zhi: '子', ruleZhi: '戌' },
            { zhi: '丑', ruleZhi: '亥' },
            { zhi: '寅', ruleZhi: '子' },
            { zhi: '卯', ruleZhi: '丑' },
            { zhi: '辰', ruleZhi: '寅' },
            { zhi: '巳', ruleZhi: '卯' },
            { zhi: '午', ruleZhi: '辰' },
            { zhi: '未', ruleZhi: '巳' },
            { zhi: '申', ruleZhi: '午' },
            { zhi: '酉', ruleZhi: '未' },
            { zhi: '戌', ruleZhi: '申' },
            { zhi: '亥', ruleZhi: '酉' },
        ]
        return yearZhiCheckOtherZhi(rules, siZhu, name)
    },
    (siZhu) => {
        const name = '披麻'
        const rules: Array<{
            zhi: string
            ruleZhi: string
        }> = [
            { zhi: '子', ruleZhi: '酉' },
            { zhi: '丑', ruleZhi: '戌' },
            { zhi: '寅', ruleZhi: '亥' },
            { zhi: '卯', ruleZhi: '子' },
            { zhi: '辰', ruleZhi: '丑' },
            { zhi: '巳', ruleZhi: '寅' },
            { zhi: '午', ruleZhi: '卯' },
            { zhi: '未', ruleZhi: '辰' },
            { zhi: '申', ruleZhi: '巳' },
            { zhi: '酉', ruleZhi: '午' },
            { zhi: '戌', ruleZhi: '未' },
            { zhi: '亥', ruleZhi: '申' },
        ]
        return yearZhiCheckOtherZhi(rules, siZhu, name)
    },
    (siZhu) => {
        const name = '十灵日'
        const rules: Array<string> = [
            '甲辰',
            '乙亥',
            '丙辰',
            '丁酉',
            '戊午',
            '庚戌',
            '庚寅',
            '辛亥',
            '壬寅',
            '癸未',
        ]
        const dayZhu = siZhu.dayGan + siZhu.dayZhi
        return [[
            false,
            false,
            rules.includes(dayZhu),
            false
        ], name]
    },
    (siZhu) => {
        const name = '六秀日'
        const rules: Array<string> = [
            '丙午',
            '丁未',
            '戊子',
            '戊午',
            '己丑',
            '己未',
        ]
        const dayZhu = siZhu.dayGan + siZhu.dayZhi
        return [[
            false,
            false,
            rules.includes(dayZhu),
            false
        ], name]
    },
    (siZhu) => {
        const name = '八专'
        const rules: Array<string> = [
            '甲寅',
            '乙卯',
            '丁未',
            '戊戌',
            '己未',
            '庚申',
            '辛酉',
            '癸丑',
        ]
        const dayZhu = siZhu.dayGan + siZhu.dayZhi
        return [[
            false,
            false,
            rules.includes(dayZhu),
            false
        ], name]
    },
    (siZhu,) => {
        const name = '九丑'
        const rules: Array<string> = [
            '丁酉',
            '戊子',
            '戊午',
            '己卯',
            '己酉',
            '辛卯',
            '辛酉',
            '壬子',
            '壬午',
        ]
        const dayZhu = siZhu.dayGan + siZhu.dayZhi
        return [[
            false,
            false,
            rules.includes(dayZhu),
            false
        ], name]
    },
    (siZhu, naYin) => {
        const name = '童子煞'
        const rules1: Array<{
            zhi: string[]
            ruleZhi: string[]
        }> = [
            { zhi: ['寅', '卯', '辰', '申', '酉', '戌'], ruleZhi: ['寅', '子'] },
            { zhi: ['巳', '午', '未', '亥', '子', '丑'], ruleZhi: ['卯', '未', '辰'] },
        ]
        const rules2: Array<{
            naYinWuXing: string[]
            ruleZhi: string[]
        }> = [
            { naYinWuXing: ['金', '木'], ruleZhi: ['午', '卯'] },
            { naYinWuXing: ['水', '火'], ruleZhi: ['酉', '戌'] },
            { naYinWuXing: ['土'], ruleZhi: ['辰', '巳'] },
        ]
        const rule1 = rules1.find(({ zhi }) => zhi.includes(siZhu.monthZhi))?.ruleZhi
        const rule2 = rules2.find(({ naYinWuXing }) => naYinWuXing.some(n => naYin.yearNaYin.includes(n)))?.ruleZhi
        if (!rule1 || !rule2) {
            console.error('规则异常', name, siZhu, name)
            return [ruleAllFalseResult, name]
        }
        return [[
            false,
            false,
            rule1.includes(siZhu.dayZhi) || rule2.includes(siZhu.dayZhi),
            rule1.includes(siZhu.hourZhi) || rule2.includes(siZhu.hourZhi),
        ], name]
    },
    (siZhu) => {
        const name = '天厨贵人'
        const rules: Array<{
            gan: string
            zhi: string
        }> = [
            { gan: '丙', zhi: '巳' },
            { gan: '丁', zhi: '午' },
            { gan: '戊', zhi: '申' },
            { gan: '己', zhi: '酉' },
            { gan: '庚', zhi: '亥' },
            { gan: '辛', zhi: '子' },
            { gan: '壬', zhi: '寅' },
            { gan: '癸', zhi: '卯' },
        ]
        return dayYearGanCheckZhi(rules, siZhu, name, true)
    },
    (siZhu) => {
        const name = '福星贵人'
        const rules: Array<{
            gan: string[]
            zhi: string[]
        }> = [
            { gan: ['甲', '丙'], zhi: ['寅', '子'] },
            { gan: ['乙', '癸'], zhi: ['卯', '丑'] },
            { gan: ['戊'], zhi: ['申'] },
            { gan: ['己'], zhi: ['未'] },
            { gan: ['丁'], zhi: ['亥'] },
            { gan: ['庚'], zhi: ['午'] },
            { gan: ['辛'], zhi: ['巳'] },
            { gan: ['壬'], zhi: ['辰'] },
        ]
        const rule1 = rules.find(({ gan }) => gan.includes(siZhu.yearGan))?.zhi
        const rule2 = rules.find(({ gan }) => gan.includes(siZhu.monthGan))?.zhi
        if (!rule1 || !rule2) {
            console.error('规则异常', name, siZhu)
            return [ruleAllFalseResult, name]
        }
        return [[
            rule1.includes(siZhu.yearZhi) || rule2.includes(siZhu.yearZhi),
            rule1.includes(siZhu.monthZhi) || rule2.includes(siZhu.monthZhi),
            rule1.includes(siZhu.dayZhi) || rule2.includes(siZhu.dayZhi),
            rule1.includes(siZhu.hourZhi) || rule2.includes(siZhu.hourZhi),
        ], name]
    },
    (siZhu) => {
        const name = '德秀贵人'
        const rules: Array<{
            zhi: string[]
            gan: string[]
        }> = [
            { zhi: ['寅', '午', '戌'], gan: ['丙', '丁', '戊', '癸'] },
            { zhi: ['申', '子', '辰'], gan: ['壬', '癸', '戊', '丙', '辛', '甲', '己'] },
            { zhi: ['巳', '酉', '丑'], gan: ['庚', '辛', '乙'] },
            { zhi: ['亥', '卯', '未'], gan: ['甲', '乙', '丁', '壬'] },
        ]
        const rule = rules.find(({ zhi }) => zhi.includes(siZhu.monthZhi))?.gan
        if (!rule) {
            console.error('规则异常', name, siZhu)
            return [ruleAllFalseResult, name]
        }
        return [[
            rule.includes(siZhu.yearGan),
            rule.includes(siZhu.monthGan),
            rule.includes(siZhu.dayGan),
            rule.includes(siZhu.hourGan),
        ], name]
    },
    (siZhu) => {
        const name = '拱禄'
        const rules: Array<{
            day: string
            hour: string
        }> = [
            { day: '癸亥', hour: '癸丑' },
            { day: '癸丑', hour: '癸亥' },
            { day: '丁巳', hour: '丁未' },
            { day: '己未', hour: '己巳' },
            { day: '戊辰', hour: '戊午' },
        ]
        const dayZhu = siZhu.dayGan + siZhu.dayZhi
        const hourZhu = siZhu.hourGan + siZhu.hourZhi
        const res = rules.some(({ day, hour }) => day === dayZhu && hour === hourZhu)
        return [[
            false,
            false,
            res,
            res
        ], name]
    }
]

function monthZhiCheckDayZhu(rules: Array<{
    zhi: Array<string>
    zhu: string
}>, siZhu: BaziSiZhu, name: string): [RuleResult, string] {
    const zhu = siZhu.dayGan + siZhu.dayZhi
    const rule = rules.find(({ zhi }) => zhi.includes(siZhu.monthZhi))?.zhu
    if (!rule) {
        console.error('规则异常', name, siZhu)
        return [ruleAllFalseResult, name]
    }
    return [[
        false,
        false,
        zhu === rule,
        false
    ], name]
}

function yearZhiCheckOtherZhi(rules: Array<{
    zhi: Array<string> | string
    ruleZhi: string
}>, siZhu: BaziSiZhu, name: string): [RuleResult, string] {
    const rule = rules.find(({ zhi }) =>
        Array.isArray(zhi) ? zhi.includes(siZhu.yearZhi) : (zhi === siZhu.yearZhi)
    )?.ruleZhi
    if (!rule) {
        console.error('规则异常', name, siZhu)
        return [ruleAllFalseResult, name]
    }
    return [[
        false,
        rule === siZhu.monthZhi,
        rule === siZhu.dayZhi,
        rule === siZhu.hourZhi,
    ], name]
}

function dayGanCheckZhi(rules: Array<{
    gan: string
    zhi: string
}>, siZhu: BaziSiZhu, name: string): [RuleResult, string] {
    const rule = rules.find(({ gan }) => gan === siZhu.dayGan)?.zhi
    if (!rule) {
        console.error('规则异常', name, siZhu)
        return [ruleAllFalseResult, name]
    }
    return [[
        rule === siZhu.yearZhi,
        rule === siZhu.monthZhi,
        rule === siZhu.dayZhi,
        rule === siZhu.hourZhi,
    ], name]
}

function dayYearZhiCheckOtherZhi(rules: Array<{
    zhi: Array<string>
    ruleZhi: string
}>, siZhu: BaziSiZhu, name: string, maybeNotRule?: boolean): [RuleResult, string] {
    const yearRuleZhi = rules.find(({ zhi }) => zhi.includes(siZhu.yearZhi))?.ruleZhi
    const dayRuleZhi = rules.find(({ zhi }) => zhi.includes(siZhu.dayZhi))?.ruleZhi
    if (!yearRuleZhi || !dayRuleZhi) {
        if (!maybeNotRule) {
            console.error('规则异常', name, siZhu)
        }
        return [ruleAllFalseResult, name]
    }
    return [[
        dayRuleZhi === siZhu.yearZhi,
        yearRuleZhi === siZhu.monthZhi || dayRuleZhi === siZhu.monthZhi,
        yearRuleZhi === siZhu.dayZhi,
        yearRuleZhi === siZhu.dayZhi || dayRuleZhi === siZhu.dayZhi,
    ], name]
}

function dayYearGanCheckZhi(rules: Array<{
    gan: string
    zhi: string
}>, siZhu: BaziSiZhu, name: string, ruleMaybeNot?: boolean): [RuleResult, string] {
    const yearRuleZhi = rules.find(({ gan }) => gan === siZhu.yearGan)?.zhi
    const dayRuleZhi = rules.find(({ gan }) => gan === siZhu.dayGan)?.zhi
    if (!yearRuleZhi || !dayRuleZhi) {
        if (!ruleMaybeNot) {
            console.error('规则异常', name, siZhu)
        }
        return [ruleAllFalseResult, name]
    }
    return [[
        yearRuleZhi === siZhu.yearZhi || dayRuleZhi === siZhu.yearZhi,
        yearRuleZhi === siZhu.monthZhi || dayRuleZhi === siZhu.monthZhi,
        yearRuleZhi === siZhu.dayZhi || dayRuleZhi === siZhu.dayZhi,
        yearRuleZhi === siZhu.hourZhi || dayRuleZhi === siZhu.hourZhi,
    ], name]
}

function ruleCheckNaYinNotYearZhi(
    rules: Array<{
        yearNaYin: string
        zhi: string
    }>,
    siZhu: BaziSiZhu,
    naYin: NaYin,
    name: string,
): [RuleResult, string] {
    const rule = rules.find(({ yearNaYin }) => naYin.yearNaYin.includes(yearNaYin))?.zhi
    if (!rule) {
        console.error('规则异常', name, siZhu, naYin)
        return [ruleAllFalseResult, name]
    }
    return [[
        false,
        siZhu.monthZhi === rule,
        siZhu.dayZhi === rule,
        siZhu.hourZhi === rule,
    ], name]
}

interface ShenSha {
    year: string[]
    month: string[]
    day: string[]
    hour: string[]
}

function eightChar2ShenSha(eightChar: EightChar, sex: 0 | 1): ShenSha {
    const shenSha: ShenSha = {
        day: [],
        hour: [],
        month: [],
        year: [],
    }
    const hourZhu = eightChar.getHour()
    const dayZhu = eightChar.getDay()
    const monthZhu = eightChar.getMonth()
    const yearZhu = eightChar.getYear()
    const siZhu: BaziSiZhu = {
        hourZhi: hourZhu.getEarthBranch().getName(),
        hourGan: hourZhu.getHeavenStem().getName(),
        dayZhi: dayZhu.getEarthBranch().getName(),
        dayGan: dayZhu.getHeavenStem().getName(),
        monthGan: monthZhu.getHeavenStem().getName(),
        yearGan: yearZhu.getHeavenStem().getName(),
        monthZhi: monthZhu.getEarthBranch().getName(),
        yearZhi: yearZhu.getEarthBranch().getName(),
    }
    const naYin: NaYin = {
        yearNaYin: yearZhu.getSound().getName(),
        dayNaYin: dayZhu.getSound().getName(),
        hourNaYin: hourZhu.getSound().getName(),
        monthNaYin: monthZhu.getSound().getName(),
    }
    const shenShaRuleResults = shenShaRules.map(ruleFn => ruleFn(siZhu, naYin, sex))
    for (const shenShaRuleResult of shenShaRuleResults) {
        const [[y, m, d, h], name] = shenShaRuleResult
        if (y) {
            shenSha.year.push(name)
        }
        if (m) {
            shenSha.month.push(name)
        }
        if (d) {
            shenSha.day.push(name)
        }
        if (h) {
            shenSha.hour.push(name)
        }
    }
    return shenSha
}

export default {
    eightChar2ShenSha: eightChar2ShenSha,
}
