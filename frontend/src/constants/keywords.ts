export interface KeywordCategory {
  id: string
  label: string
  tags: string[]
}

export const KEYWORD_CATEGORIES: KeywordCategory[] = [
  {
    id: 'building',
    label: '建筑主题',
    tags: [
      '厂房',
      '大桥',
      '高楼',
      '起重机',
      '吊车',
      '烟囱',
      '管道',
      '钢架',
      '塔吊',
      '脚手架',
    ],
  },
  {
    id: 'expression',
    label: '视觉形态',
    tags: ['线稿', '剪影', '半调', '像素'],
  },
  {
    id: 'tiling',
    label: '阵列风格',
    tags: ['平铺', '砖墙', '万花筒', '镜像'],
  },
]

export interface CupShowcaseItem {
  id: string
  label: string
  image: string
}

export const CUP_SHOWCASE: CupShowcaseItem[] = [
  { id: 'straight', label: '直杯', image: '/cup/IMG_7800.PNG' },
  { id: 'mug', label: '马克杯', image: '/cup/IMG_7801.PNG' },
  { id: 'tea', label: '茶杯', image: '/cup/IMG_7802.PNG' },
  { id: 'relief', label: '浮雕杯', image: '/cup/IMG_7803.PNG' },
  { id: 'architecture', label: '建筑杯', image: '/cup/IMG_7804.PNG' },
  { id: 'metal', label: '金属杯', image: '/cup/IMG_7805.PNG' },
]
