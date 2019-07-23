import Profile from "./Profile"

export default class Article {
    title: string
    slug: string
    body: string
    createdAt: string
    updatedAt: string
    tagList: string[]
    description: string
    profile: Profile
    favorited: boolean
    favoritesCount: number

    public static init = (object: any) => {
        return new Article(object.title, object.slug, object.body, object.updatedAt, object.updatedAt, object.tagList,
            object.description, object.profile, object.favorited, object.favoritesCount )
    }

    constructor(title: string, slug: string, body: string, createdAt: string, updatedAt: string,
        tagList: string[], description: string, profile: Profile, favorited: boolean, favoritesCount: number ) {
        this.title = title
        this.slug = slug
        this.body = body
        this.createdAt = createdAt
        this.updatedAt = updatedAt
        this.tagList = tagList
        this.description = description
        this.profile = profile
        this.favorited = favorited
        this.favoritesCount = favoritesCount
    }
}
