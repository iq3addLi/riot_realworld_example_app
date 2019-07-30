export default class MenuItem {
    identifier: string
    title: string
    isActive: boolean
    href: string
    icon?: string = null
    image?: string = null

    constructor(identifier: string, title: string, href: string, isActive: boolean, icon?: string, image?: string) {
        this.identifier = identifier
        this.title = title
        this.isActive = isActive
        this.href = href
        this.icon = (icon !== undefined) ? icon : null
        this.image = (image !== undefined) ? image : null
    }
}
