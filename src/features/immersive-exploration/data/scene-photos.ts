/**
 * 沉浸场景 · 实景照片配置（DATA 拥有，V1.2 新增）
 *
 * 每个黄金样例场景配一组本地实景照片（public/immersive/photos/），
 * 由 SceneCanvas 的背景层轮播展示（Ken Burns 缓慢缩放 + 交叉淡入）。
 *
 * 来源与署名：
 * - 富士山 / 马尔代夫水下：Unsplash 实景图库（Unsplash License，可自由商用）
 * - 洞爷湖航拍：Hokkaido Tourism Organization · HOKKAIDO LOVE! 官方景点页
 *
 * 照片已本地化，离线可用、秒级加载；新增场景时把照片放进
 * public/immersive/photos/ 并在 SCENE_PHOTOS 里登记即可。
 */

export interface ScenePhoto {
  /** 本地路径（相对 public 根） */
  src: string;
  /** 简短说明（alt / 角落标注） */
  caption: string;
  /** 署名文本（角落显示） */
  credit: string;
  /** 来源页 URL */
  sourceUrl: string;
}

const UNSPLASH = "Unsplash 实景图库";
const UNSPLASH_URL = "https://unsplash.com/";

const SCENE_PHOTOS: Readonly<Record<string, readonly ScenePhoto[]>> = {
  "scene-mount-fuji": [
    {
      src: "/immersive/photos/mount-fuji-sakura.jpg",
      caption: "富士山 · 樱花季远眺雪顶",
      credit: UNSPLASH,
      sourceUrl: UNSPLASH_URL,
    },
    {
      src: "/immersive/photos/mount-fuji-chureito.jpg",
      caption: "富士山 · 忠灵塔与吉田市街景",
      credit: UNSPLASH,
      sourceUrl: UNSPLASH_URL,
    },
    {
      src: "/immersive/photos/mount-fuji-alpenglow.jpg",
      caption: "富士山 · 黄昏日照金山",
      credit: UNSPLASH,
      sourceUrl: UNSPLASH_URL,
    },
  ],
  "scene-lake-toya": [
    {
      src: "/immersive/photos/lake-toya-aerial.jpg",
      caption: "洞爷湖 · 中岛与羊蹄山方向航拍",
      credit: "Hokkaido Tourism Organization · HOKKAIDO LOVE!",
      sourceUrl: "https://www.visit-hokkaido.jp/cn/spot/detail_10050.html",
    },
    {
      src: "/immersive/photos/lake-toya-jetty.jpg",
      caption: "湖畔 · 清晨木栈道与镜面倒影",
      credit: UNSPLASH,
      sourceUrl: UNSPLASH_URL,
    },
  ],
  "scene-maldives-coral-garden": [
    {
      src: "/immersive/photos/maldives-coral-garden.jpg",
      caption: "珊瑚花园 · 鹿角珊瑚与成群雀鲷",
      credit: UNSPLASH,
      sourceUrl: UNSPLASH_URL,
    },
    {
      src: "/immersive/photos/maldives-reef-diver.jpg",
      caption: "礁缘 · 潜水员与笛鲷鱼群",
      credit: UNSPLASH,
      sourceUrl: UNSPLASH_URL,
    },
    {
      src: "/immersive/photos/maldives-shark-caustics.jpg",
      caption: "浅滩 · 礁鲨与海底光斑",
      credit: UNSPLASH,
      sourceUrl: UNSPLASH_URL,
    },
  ],
  "scene-masai-mara": [
    {
      src: "/immersive/photos/masai-mara-1.jpg",
      caption: "塞伦盖蒂 · 游猎车与金合欢日落",
      credit: UNSPLASH,
      sourceUrl: UNSPLASH_URL,
    },
    {
      src: "/immersive/photos/masai-mara-2.jpg",
      caption: "稀树草原 · 孤独伞形金合欢与金色地平线",
      credit: UNSPLASH,
      sourceUrl: UNSPLASH_URL,
    },
    {
      src: "/immersive/photos/masai-mara-3.jpg",
      caption: "马赛马拉 · 雨季草海中的非洲水牛群",
      credit: UNSPLASH,
      sourceUrl: UNSPLASH_URL,
    },
  ],
  "scene-tokyo-skytree": [
    {
      src: "/immersive/photos/tokyo-skytree-1.jpg",
      caption: "东京晴空塔 · 白色桁架塔身仰拍",
      credit: "Basile Morin / Wikimedia Commons (CC BY-SA 4.0)",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Worm%27s-eye_view_of_Tokyo_Skytree_with_vertical_symmetry_impression,_a_sunny_day,_in_Japan.jpg",
    },
    {
      src: "/immersive/photos/tokyo-skytree-2.jpg",
      caption: "东京晴空塔 · 夜间「粋」淡蓝点灯",
      credit: "Kakidai / Wikimedia Commons (CC BY-SA 3.0)",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Tokyo_Skytree_at_night_(Iki).jpg",
    },
    {
      src: "/immersive/photos/tokyo-skytree-3.jpg",
      caption: "东京晴空塔 · 夜间「雅」江户紫点灯",
      credit: "Kakidai / Wikimedia Commons (CC BY-SA 3.0)",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Tokyo_Skytree_at_night_(Miyabi).jpg",
    },
  ],
  "scene-duku-highway": [
    {
      src: "/immersive/photos/duku-highway-1.jpg",
      caption: "独库公路 · 盘山路段与远处雪山",
      credit: UNSPLASH,
      sourceUrl: "https://unsplash.com/photos/CJ-9tI7vSLU",
    },
    {
      src: "/immersive/photos/duku-highway-2.jpg",
      caption: "那拉提段 · 绿色高山草甸",
      credit: UNSPLASH,
      sourceUrl: "https://unsplash.com/photos/DznqzDPA0WM",
    },
    {
      src: "/immersive/photos/duku-highway-3.jpg",
      caption: "哈希勒根达坂 · 雪山垭口与云杉林",
      credit: UNSPLASH,
      sourceUrl: "https://unsplash.com/photos/AzhDCpq2AqE",
    },
  ],
};

/** 按 sceneDefinitionId 取实景照片组；未配置返回空数组（背景层自动隐藏）。 */
export function getScenePhotos(sceneDefinitionId: string): readonly ScenePhoto[] {
  return SCENE_PHOTOS[sceneDefinitionId] ?? [];
}
