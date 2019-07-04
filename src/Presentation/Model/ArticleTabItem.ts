export default class ArticleTabItem {
    title: string
    href: string
    isActive: boolean

    constructor(title: string, href: string, isActive: boolean) {
        this.title = title
        this.href =  href
        this.isActive = isActive
    }
}
