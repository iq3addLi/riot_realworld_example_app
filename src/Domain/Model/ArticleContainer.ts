import Article from "./Article"

export default class ArticleContainer {
    count: number
    articles: Article[]

    constructor(count: number, articles: Article[]) {
        this.count = count
        this.articles = articles
    }
}
