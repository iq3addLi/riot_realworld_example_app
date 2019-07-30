
// {
//     "profile": {
//         "username": "arupaka2525",
//         "bio": "My butt is danger",
//         "image": "",
//         "following": false
//     }
// }

export default class Profile {
    username: string
    bio: string
    image: string
    following: boolean

    public static init = (object: any) => {
        return new Profile(object.username, object.bio, object.image, object.following )
    }

    constructor( username: string, bio: string, image: string, following: boolean ) {
        this.username = username
        this.bio = bio
        this.image = image
        this.following = following
    }
}
