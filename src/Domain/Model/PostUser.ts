export default class PostUser {
    email: string
    username: string
    bio?: string
    image?: string

    public static init = (object: any) => {
        return new PostUser( object.email, object.username, object.bio, object.image)
    }

    constructor(email: string, username: string, bio?: string, image?: string) {
        this.email = email
        this.username = username
        this.bio = bio
        this.image = image
    }
}
