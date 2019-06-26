import Author from "./Author"

export default class Article {
    title: string
    slug: string
    body: string
    createdAt: string
    updatedAt: string
    tagList: string[]
    description: string
    author: Author
    favorited: boolean
    favoritesCount: number

    constructor(title: string, slug: string, body: string, createdAt: string, updatedAt: string,
        tagList: string[], description: string, author: Author, favorited: boolean, favoritesCount: number ) {
        this.title = title
        this.slug = slug
        this.body = body
        this.createdAt = createdAt
        this.updatedAt = updatedAt
        this.tagList = tagList
        this.description = description
        this.author = author
        this.favorited = favorited
        this.favoritesCount = favoritesCount
    }
}
