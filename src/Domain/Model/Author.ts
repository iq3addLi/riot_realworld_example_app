export default class Author {
    username: string
    bio?: string
    image: string
    following: boolean

    constructor(username: string, image: string, following: boolean, bio?: string) {
        this.username = username
        this.image = image
        this.following = following
        this.bio = bio
    }
}
