package xyz.xiewenwen.blog.article;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
public class ArticleDataSeeder implements ApplicationRunner {

	private final ArticleRepository articleRepository;

	public ArticleDataSeeder(ArticleRepository articleRepository) {
		this.articleRepository = articleRepository;
	}

	@Override
	public void run(ApplicationArguments args) {
		seedIfAbsent(
				"欢迎来到代码跳舞博客",
				"welcome-to-code-dance",
				"这不只是一个博客，是一个会跳舞、有音乐、能互动的舞台。",
				"""
				## 你好，舞者

				这里是 **xiewenwen.xyz**，一个有点不一样的博客。

				### 你能玩什么

				- 首页看代码块跳舞
				- 点击播放，来杯好茶摇一摇
				- 右上角互动墙：击掌、投票、发弹幕
				- 你的留言会登上舞台领舞

				### 为什么叫代码跳舞

				因为我觉得，每一行代码都值得一支舞。

				```java
				while (alive) {
				    code.dance();
				}
				```

				欢迎常来玩。
				""",
				"#00f5ff");

		seedIfAbsent(
				"我把博客部署到了腾讯云",
				"deploy-to-tencent-cloud",
				"Spring Boot + MySQL + Nginx + HTTPS，从本地到 xiewenwen.xyz 的部署笔记。",
				"""
				## 部署架构

				```text
				浏览器 → Nginx(443) → Spring Boot(8080) → MySQL
				```

				### 关键组件

				1. **systemd** 守护 Java 进程，崩了自动重启
				2. **Nginx** 反代 + HTTPS 证书
				3. **MySQL** 存储留言、成就、文章

				### 部署命令

				本地改完代码后，一条脚本就能上线：

				```powershell
				python deploy\\remote_deploy.py
				```

				上传源码 → 服务器编译 → 重启服务，全自动。
				""",
				"#ff2d95");

		seedIfAbsent(
				"留言变舞者：互动功能是怎么做的",
				"message-becomes-dancer",
				"最新留言登上首页舞台，还有成就系统和今日舞王榜。",
				"""
				## 互动设计

				访客不只能看，还能**参与表演**。

				### 留言变舞者

				最新 6 条留言会替换首页的代码块，带着昵称和内容一起跳舞。

				### 成就系统

				| 成就 | 条件 |
				|------|------|
				| 初登舞台 | 第一条留言 |
				| 拍手大师 | 今日击掌 5 次 |
				| C位出道 | 留言登上舞台 |

				### 今日舞王榜

				每天统计留言王和击掌王，看看谁今天最活跃。

				> 快来留言，占领 C 位。
				""",
				"#b44dff");

		seedIfAbsent(
				"首页 ASCII 视频舞台：整体方案",
				"ascii-video-overview",
				"点击播放后，整屏代码雨变成实时字符视频——这是怎么串起来的。",
				"""
				## 目标

				首页本来只有**代码雨**和**合成电子乐**。后来想加一层：播放 BGM 时，背景不再是随机字符，而是把一段 MP4 **实时转成 ASCII 字符画**。

				核心约束：

				- 纯前端实现，不占用服务端算力
				- 视频文件走 Spring Boot 静态资源
				- 音频、视频分开：BGM 单独播，视频只负责画面
				- 手机也要能跑，CPU 不能炸

				### 架构一览

				```text
				用户点击 ▶
				  ↓
				media-loader.js   fetch 视频 + 音频 → Blob URL
				  ↓
				music.js          播放 bgm.mp3（独立 <audio>）
				  ↓
				派发 blog:music-playing 事件
				  ↓
				ascii-video.js    隐藏 <video> 解码帧 → Canvas 字符渲染
				dance.js          停止代码雨，切到 ASCII 模式
				```

				### 关键文件

				| 文件 | 职责 |
				|------|------|
				| `ascii-video.js` | 视频帧 → 字符格子 → 主 Canvas |
				| `media-loader.js` | 预下载媒体、进度条、Blob 注入 |
				| `media-url.js` | 版本号缓存穿透 `?v=` |
				| `music.js` | BGM 播放，触发 `blog:music-playing` |
				| `index.html` | 隐藏 `<video>` + `<audio>` 标签 |

				### 为什么不用服务端转码

				也可以 FFmpeg 预生成 ASCII 帧或 WebM，但：

				- 部署体积更大
				- 改字符集/密度要重新渲染
				- 浏览器 Canvas 方案改参数即时生效

				实时转换的好处是**字符集可定制**（我把 `whilefor` 等关键字混进亮度表），并且和「代码跳舞」主题一致。

				### 降级策略

				视频加载失败时，`ProceduralSource` 会生成一段**程序化霓虹动画**顶替，不影响播放按钮和 BGM。

				> 下一篇：《用 Canvas 把 MP4 实时转成字符画》讲渲染管线细节。
				""",
				"#39ff14");

		seedIfAbsent(
				"用 Canvas 把 MP4 实时转成字符画",
				"ascii-video-render-pipeline",
				"采样、亮度映射、字符集设计，以及移动端降密度优化。",
				"""
				## 渲染管线

				每一帧的执行顺序：

				```text
				<video> 当前帧
				  ↓ drawImage 缩小到 cols × rows 像素
				sample Canvas（极小离屏画布）
				  ↓ getImageData 读 RGBA
				逐格算亮度 lum = 0.299R + 0.587G + 0.114B
				  ↓ 映射到字符
				主 Canvas fillText（带颜色增强）
				```

				### 1. 隐藏视频源

				HTML 里放一个不可见的 video，只负责解码：

				```html
				<video id="ascii-video-source" muted loop playsinline preload="none">
				  <source src="/video/ascii.mp4" type="video/mp4">
				</video>
				```

				**必须静音**：视频里往往自带音轨，若和 BGM 同时播放会相位干涉，听起来像音量忽大忽小。

				### 2. 降采样

				不是逐像素画字符，而是先把画面缩到网格：

				```javascript
				const cols = Math.floor(canvas.width / cellW);
				const rows = Math.floor(canvas.height / cellH);
				sampleCtx.drawImage(video, 0, 0, cols, rows);
				```

				`cellW / cellH` 就是「字符格子」大小。格子越大，字符越少，CPU 越轻松。

				### 3. 亮度 → 字符

				字符集按视觉密度从暗到亮排列：

				```javascript
				const CHARS_BY_LUM =
				  ' .·\\'`,:;!i1lI|\\\\/[]{}()jfLrtxnuvczXYUCJZF0*+#MW@$&%代码跳舞whileforifelseasyncawait';
				```

				暗部用 `.` 空格，亮部用 `@#` 或中文关键字。亮度越高，字符越「密」。

				### 4. 颜色增强

				字符颜色直接取采样 RGB，并做轻微提亮：

				```javascript
				_boost(v) { return Math.min(255, Math.floor(v * 1.15 + 18)); }
				```

				低于阈值的像素直接跳过，背景保持深色 `#0a0e17`。

				### 5. 移动端降密度

				根据屏宽动态放大格子：

				| 场景 | cellW × cellH |
				|------|----------------|
				| 桌面 | 12 × 16 |
				| 平板/手机 | 14 × 18 |
				| 小屏 | 16 × 20 |

				字符数量大约降到原来的 40%，帧率明显更稳。

				### 6. 与代码雨切换

				监听自定义事件：

				```javascript
				document.addEventListener('blog:music-playing', (e) => {
				  if (e.detail.playing) {
				    CodeRain.stop();
				    player.start();  // 启动 ASCII + video.play()
				  } else {
				    player.stop();
				    CodeRain.start();
				  }
				});
				```

				播放时复用同一个 `#code-rain` Canvas，暂停后恢复代码雨。

				> 下一篇：《大视频预加载与移动端踩坑记录》讲 media-loader 和缓存。
				""",
				"#ffe600");

		seedIfAbsent(
				"大视频预加载与移动端踩坑记录",
				"ascii-video-media-loading",
				"fetch 整段 MP4、Blob URL、92% 卡住、QQ 浏览器缓存——挨个说。",
				"""
				## 为什么要预加载

				ASCII 渲染依赖 `<video>` 的**当前帧**。如果边下边播，seek 和解码不稳定，字符画会闪。

				所以第一次点播放前，`media-loader.js` 会：

				- 用 **fetch** 把 MP4 整段拉下来
				- 转成 **Blob URL** 赋给 `<video>.src`
				- 音频同样 fetch 后注入 `<audio>`

				同一会话内第二次播放，Blob 已在内存，**秒开**。

				### 进度条怎么算

				视频约占 92% 权重（文件 ~11MB），音频约占 8%（~2MB）：

				```javascript
				const mix = videoP * 0.92 + audioP * 0.08;
				```

				所以视频下完后会长时间停在 **92%**，文案显示「同步音频轨道...」——这不是卡死，是在等音频。

				### 手机端 92% 不动的修复

				iOS / 安卓上，`<audio>` 的 `canplaythrough` 经常**永远不触发**。

				改法：

				- 音频也走 **fetchBlob**，有真实下载进度
				- 就绪条件改为 `canplay` / `loadeddata`
				- **10 秒超时**兜底，避免无限等待

				### 缓存穿透

				换过 BGM 后 QQ 浏览器仍播旧文件。加了版本号：

				```html
				<script>window.__BLOG_MEDIA_V='20250614-bruce-v2';</script>
				```

				`media-url.js` 自动给 `/audio/`、`/video/` 链接追加 `?v=`。

				后端 `MediaCacheFilter` 对媒体路径设置：

				```text
				Cache-Control: no-cache, no-store, must-revalidate
				```

				### 音频格式坑

				文件扩展名是 `.mp3`，实际是 **MP4 容器**（Suno 导出常见）。HTML 要写：

				```html
				<source src="/audio/bgm.mp3" type="audio/mp4">
				```

				### 部署路径

				```text
				src/main/resources/static/video/ascii.mp4
				src/main/resources/static/audio/bgm.mp3
				```

				部署脚本 `deploy/remote_deploy.py` 打包整个 `src/`，服务器 Maven 编译后静态资源进 JAR，Nginx 反代即可访问。

				### 后续可优化

				- 视频压到 720p / 10～20 秒循环，体积能到 5MB 以内
				- 改为 **Range 请求** 边下边播，牺牲一点帧稳定性换首屏速度
				- Service Worker 缓存 Blob，二次访问更快

				> 回到首页点 ▶，亲眼看看代码里藏着的画面。
				""",
				"#00f5ff");
	}

	private void seedIfAbsent(String title, String slug, String summary, String content, String accentColor) {
		if (!articleRepository.existsBySlug(slug)) {
			articleRepository.save(new Article(title, slug, summary, content, accentColor));
		}
	}
}
