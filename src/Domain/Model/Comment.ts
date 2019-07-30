import Profile from "./Profile"

// "comments": [
//     {
//         "id": 42546,
//         "createdAt": "2019-07-13T23:42:57.417Z",
//         "updatedAt": "2019-07-13T23:42:57.417Z",
//         "body": "ok",
//         "author": {
//             "username": "ruslanguns2",
//             "bio": null,
//             "image": "https://static.productionready.io/images/smiley-cyrus.jpg",
//             "following": false
//         }
//     }
// ]

export default class Comment {
    id: number
    createdAt: Date
    updatedAt: Date
    body: string
    author: Profile

    public static init = (object: any) => {
        return new Comment(object.id, new Date(object.createdAt), new Date(object.updatedAt), object.body,
            object.author )
    }

    constructor(id: number, createdAt: Date, updatedAt: Date, body: string, author: Profile ) {
        this.id = id
        this.createdAt = createdAt
        this.updatedAt = updatedAt
        this.body = body
        this.author = author
    }
}
