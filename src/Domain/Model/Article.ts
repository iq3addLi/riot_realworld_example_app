import Profile from "./Profile"
// import Initializable from "../../Infrastructure/Initializable"

export default class Article/* implements Initializable*/ {
    title: string
    slug: string
    body: string
    createdAt: Date
    updatedAt: Date
    tagList: string[]
    description: string
    author: Profile
    favorited: boolean
    favoritesCount: number

    public static init = (object: any) => {
        return new Article(object.title, object.slug, object.body, new Date(object.createdAt), new Date(object.updatedAt), object.tagList,
            object.description, object.author, object.favorited, object.favoritesCount )
    }

    constructor(title: string, slug: string, body: string, createdAt: Date, updatedAt: Date,
        tagList: string[], description: string, profile: Profile, favorited: boolean, favoritesCount: number ) {
        this.title = title
        this.slug = slug
        this.body = body
        this.createdAt = createdAt
        this.updatedAt = updatedAt
        this.tagList = tagList
        this.description = description
        this.author = profile
        this.favorited = favorited
        this.favoritesCount = favoritesCount
    }
}
