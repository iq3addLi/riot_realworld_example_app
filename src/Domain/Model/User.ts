export default class User {
    id: number
    email: string
    createdAt: Date
    updatedAt: Date
    username: string
    token: string
    bio?: string
    image?: string

    public static init = (object: any) => {
        return new User(object.id, object.email, object.createdAt, object.updatedAt, object.username,
            object.token, object.bio, object.image)
    }

    constructor(id: number, email: string, createdAt: Date, updatedAt: Date,
        username: string, token: string, bio?: string, image?: string) {
        this.id = id
        this.email = email
        this.createdAt = createdAt
        this.updatedAt = updatedAt
        this.username = username
        this.token = token
        this.bio = bio
        this.image = image
    }
}

// {"user":
//     {"id":58598,
//     "email":"buyer01@ahk.jp",
//     "createdAt":"2019-06-20T02:56:36.621Z",
//     "updatedAt":"2019-06-20T02:56:36.630Z",
//     "username":"arupaka2525",
//     "bio":null,
//     "image":null,
//     "token":"..."
//     }
// }
