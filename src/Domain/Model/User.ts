export default class User {
    id: number
    email: string
    createdAt: Date
    updatedAt: Date
    username: string
    bio?: string
    image?: string
    token: string

    public static init = (object: any) => {
        return new User(object.id, object.email, object.createdAt, object.updatedAt, object.bio, object.image, object.token)
    }

    constructor(id: number, email: string, createdAt: Date, updatedAt: Date, token: string, bio?: string, image?: string) {
        this.id = id
        this.email = email
        this.createdAt = createdAt
        this.updatedAt = updatedAt
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
