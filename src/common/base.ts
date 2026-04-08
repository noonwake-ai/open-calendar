export type Byte = number
export type Int = number
export type Long = number
export type Short = number
export type Float = number

export type DateTime = string
export type PlainValueWithoutArr = null | undefined | boolean | number | string | Record<string, PlainValue>
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
export type PlainValue = null | undefined | boolean | number | string | PlainValue[] | Record<string, PlainValue>
export type MaybeArray<T> = T | T[]
export type MaybePromise<T> = T | Promise<T>

export type BasicValueType = null | undefined | boolean | number | string | symbol

export type DictOf<V> = {
    [key: string]: V
}

// eslint-disable-next-line @typescript-eslint/ban-types
export type  JSONStringOf<T extends {}> = string
export type  EncryptOf<T extends {}> = string

export type UnionToIntersection<U> =
    (U extends any ? (k: U) => void : never) extends ((k: infer I) => void) ? I : never
type LastOf<T> =
    UnionToIntersection<T extends any ? () => T : never> extends () => (infer R) ? R : never

// TS4.0+
type Push<T extends any[], V> = [...T, V];

// TS4.1+
export type TuplifyUnion<T, L = LastOf<T>, N = [T] extends [never] ? true : false> =
    true extends N ? [] : Push<TuplifyUnion<Exclude<T, L>>, L>

export type OptionalKeys<T> = {
    [K in keyof T]-?: undefined extends T[K] ? K : never
}[keyof T]

export type OptionalWithNull<T> = {
    [K in keyof T]: K extends OptionalKeys<T> ? T[K] | null : T[K]
}

export type NullableDictOf<T extends DictOf<any>> = {
    [K in keyof T]: T[K] | null
}

type NullKeyOf<T> = {
    [K in keyof T]-?: null extends T[K] ? K : never
}[keyof T]

type NonNullKeyOf<T> = {
    [K in keyof T]-?: null extends T[K] ? never : K
}[keyof T]

export type ObjectNullWithOptional<T> = {
    [K in NullKeyOf<T>]?: T[K]
} & {
    [K in NonNullKeyOf<T>]: T[K]
}

export type ObjNullToOptional<T> = {
    [K in NullKeyOf<T>]?: Exclude<T[K], null>
} & {
    [K in NonNullKeyOf<T>]: T[K]
}

export type NonNullRequired<T> = {
    [K in keyof T]-?: Exclude<T[K], null>
}

export type CopyDict<D> = Pick<D, keyof D>

export type ImportDataByExcelRes = {
    failRowsLen: Int
    failRowsFile?: string
}

export type DictPaths<T extends Record<string, any>> = {
    [K in keyof T]:
    T[K] extends string | number | null | undefined
        ? K extends string
            ? K
            : never
        : T[K] extends (infer E extends Record<string, any>)[]
            ? K extends string ? `${K}.${DictPaths<E>}` : never
            : K extends string ? `${K}.${DictPaths<T[K]>}` : never
}[keyof T]

export type ImageInfo = {
    url: string
    w?: Float
    h?: Float
}

export type MinaSSEMsg = {
    content: string
    type: 'concat' | 'replace'
}

export function email2Preview(email: string) {
    const [username, domain] = email.split('@')
    const visibleLen = Math.min(3, username.length)
    const masked = '*'.repeat(username.length - visibleLen)
    return username.slice(0, visibleLen) + masked + '@' + domain
}

export function phone2Preview(phone: string) {
    const cleanPhone = phone.replace(/[\s-]/g, '')
    const len = cleanPhone.length

    if (len <= 6) {
        // 太短的号码只保留首尾 1 位
        return cleanPhone.replace(/^(.)(.*)(.)$/, (_, a, b, c) => {
            return a + '*'.repeat(b.length) + c
        })
    }

    const headLen = 3
    const tailLen = len >= 11 ? 4 : 3 // 国际长号保留 4 位尾数

    const head = cleanPhone.slice(0, headLen)
    const tail = cleanPhone.slice(-tailLen)
    const masked = '*'.repeat(len - headLen - tailLen)

    return head + masked + tail
}
