import { TengodId } from '../common/utils/bazi'

export type ProjectionScene = 'idle' | 'wake' | 'interpret' | 'casting'

type ProjectionVideoMap = Record<TengodId, Record<ProjectionScene, string[]>>

// Pi 专用视频存放在 src/back/pi/assets/video/{TENGOD_ID}/{scene}/
// 与 AllSpirit APP 资源完全隔离，后续补充其他十神时在对应目录下新增文件夹即可
const rawVideoModules = import.meta.glob(
    '../assets/video/*/{idle,wake,interpret,casting}/*.{mp4,webm,mov}',
    {
        eager: true,
        import: 'default',
        query: '?url',
    }
) as Record<string, string>

function createEmptyProjectionVideoMap(): ProjectionVideoMap {
    return {
        [TengodId.BIJIAN]: { idle: [], wake: [], interpret: [], casting: [] },
        [TengodId.JIECAI]: { idle: [], wake: [], interpret: [], casting: [] },
        [TengodId.SHISHEN]: { idle: [], wake: [], interpret: [], casting: [] },
        [TengodId.SHANGGUAN]: { idle: [], wake: [], interpret: [], casting: [] },
        [TengodId.PIANCAI]: { idle: [], wake: [], interpret: [], casting: [] },
        [TengodId.ZHENGCAI]: { idle: [], wake: [], interpret: [], casting: [] },
        [TengodId.QISHA]: { idle: [], wake: [], interpret: [], casting: [] },
        [TengodId.ZHENGGUAN]: { idle: [], wake: [], interpret: [], casting: [] },
        [TengodId.PIANYIN]: { idle: [], wake: [], interpret: [], casting: [] },
        [TengodId.ZHENGYIN]: { idle: [], wake: [], interpret: [], casting: [] },
    }
}

function normalizeTengodId(folderName: string): TengodId | null {
    const tengodId = folderName.toUpperCase() as TengodId
    return Object.values(TengodId).includes(tengodId) ? tengodId : null
}

function normalizeSceneName(sceneName: string): ProjectionScene | null {
    if (sceneName === 'idle' || sceneName === 'wake' || sceneName === 'interpret' || sceneName === 'casting') {
        return sceneName
    }
    return null
}

const projectionVideoMap = Object.entries(rawVideoModules).reduce((acc, [path, url]) => {
    const videoRoot = '/video/'
    const videoRootIndex = path.indexOf(videoRoot)
    if (videoRootIndex < 0) {
        return acc
    }

    const relativePath = path.slice(videoRootIndex + videoRoot.length)
    const [folderName, sceneName] = relativePath.split('/')
    const tengodId = normalizeTengodId(folderName)
    const scene = normalizeSceneName(sceneName)

    if (!tengodId || !scene) {
        return acc
    }

    acc[tengodId][scene].push(url)
    return acc
}, createEmptyProjectionVideoMap())

for (const sceneMap of Object.values(projectionVideoMap)) {
    for (const videos of Object.values(sceneMap)) {
        videos.sort((a, b) => a.localeCompare(b, 'zh-Hans-CN', { numeric: true, sensitivity: 'base' }))
    }
}

export function getProjectionVideos(tengodId?: string | null, scene: ProjectionScene = 'idle'): string[] {
    if (!tengodId) {
        return []
    }

    return projectionVideoMap[tengodId as TengodId]?.[scene] ?? []
}
