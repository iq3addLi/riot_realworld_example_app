export default class PostArticle {
    title: string
    description: string
    body: string
    tagList?: string[]

    constructor(title: string, description: string, body: string, tagList?: string[] ) {
        this.title = title
        this.description = description
        this.body = body
        this.tagList = tagList
    }
}
