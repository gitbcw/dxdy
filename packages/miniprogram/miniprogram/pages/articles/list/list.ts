const { getOfficialArticles, recordArticleClick } = require('../../../services/index')

type ArticleItem = {
  id: string
  title: string
  subtitle: string
  coverUrl: string
  articleUrl: string
  tag: string
}

function toArticleItem(article: any): ArticleItem {
  return {
    id: article.id || article._id,
    title: article.title || '',
    subtitle: article.subtitle || '',
    coverUrl: article.coverUrl || '',
    articleUrl: article.articleUrl || '',
    tag: article.tag || '推荐',
  }
}

Page({
  data: {
    articles: [] as ArticleItem[],
    loading: true,
    error: '',
  },

  async onLoad() {
    await this.loadArticles()
  },

  async onPullDownRefresh() {
    await this.loadArticles()
    wx.stopPullDownRefresh()
  },

  async loadArticles() {
    this.setData({ loading: true, error: '' })
    try {
      const articles = (await getOfficialArticles(100)).map(toArticleItem)
      this.setData({ articles, loading: false })
    } catch (err) {
      this.setData({
        loading: false,
        error: err instanceof Error ? err.message : '加载文章失败',
      })
    }
  },

  onArticleTap(e: any) {
    const idx = e.currentTarget.dataset.idx
    const item = this.data.articles[idx]
    if (!item?.articleUrl) return
    recordArticleClick(item.id, item.title, 'list')
    wx.navigateTo({
      url: `/pages/articles/webview/webview?id=${item.id}&url=${encodeURIComponent(item.articleUrl)}&title=${encodeURIComponent(item.title || '内容精选')}`,
    })
  },

  onRetry() {
    this.loadArticles()
  },
})

export {}
