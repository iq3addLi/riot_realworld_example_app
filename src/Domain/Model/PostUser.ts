export default class PostUser {
    email: string
    username: string
    bio: string
    image: string
    password?: string

    public static init = (object: any) => {
        return new PostUser( object.email, object.username, object.bio, object.image, object.password)
    }

    constructor(email: string, username: string, bio: string, image: string, password?: string) {
        this.email = email
        this.username = username
        this.bio = bio
        this.image = image
        this.password = password
    }

    trimmed = () => {
        let object = {
            "email": this.email,
            "username": this.username,
            "bio": this.bio,
            "image": this.image
        }
        if ( this.password || this.password.length !== 0) { object["password"] = this.password }

        return object
    }
}
