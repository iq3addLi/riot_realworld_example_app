export default class ArticleTabItem {
    identifier: string
    title: string
    isActive: boolean

    constructor(identifier: string, title: string, isActive: boolean) {
        this.identifier = identifier
        this.title = title
        this.isActive = isActive
    }
}
