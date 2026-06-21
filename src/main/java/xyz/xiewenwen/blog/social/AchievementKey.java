package xyz.xiewenwen.blog.social;

public enum AchievementKey {
	DEBUT("初登舞台", "发出第一条留言"),
	CHATTERBOX("话痨舞者", "今日留言达 3 条"),
	CLAP_MASTER("拍手大师", "今日击掌达 5 次"),
	TEA_SOUL("企鹅茶友", "投票「喝茶中」"),
	DANCE_KING("舞王附体", "投票「跳舞中」"),
	ON_STAGE("C 位出道", "留言登上舞台领舞");

	private final String title;
	private final String desc;

	AchievementKey(String title, String desc) {
		this.title = title;
		this.desc = desc;
	}

	public String getTitle() {
		return title;
	}

	public String getDescription() {
		return desc;
	}
}
