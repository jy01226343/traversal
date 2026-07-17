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
};

/** 按 sceneDefinitionId 取实景照片组；未配置返回空数组（背景层自动隐藏）。 */
export function getScenePhotos(sceneDefinitionId: string): readonly ScenePhoto[] {
  return SCENE_PHOTOS[sceneDefinitionId] ?? [];
}
