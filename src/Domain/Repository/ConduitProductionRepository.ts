import ConduitRepository from "./interface/ConduitRepository"
import User from "../Model/User"
import Article from "../Model/Article"
import PostArticle from "../Model/PostArticle"
import Comment from "../Model/Comment"
import Profile from "../Model/Profile"
import UserForm from "../Model/UserForm"
import ServerError from "../Model/ServerError"
import ArticleContainer from "../Model/ArticleContainer"
import PostUser from "../Model/PostUser"

export default class ConduitProductionRepository implements ConduitRepository {

    // Auths

    // login: (email: string, password: string ) => Promise<User>
    login = (email: string, password: string ) => {
        return new Promise<User>( async (resolve, reject) => {
            try {
                const response = await fetch("https://conduit.productionready.io/api/users/login", {
                    headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                    },
                    method: "POST",
                    body: JSON.stringify({"user": {"email": email, "password": password}})
                })
                if ( response.status === 200 ) {
                    const json = await response.json()
                    let user = User.init(json.user)
                    resolve( user )
                } else if ( response.status === 422 ) {
                    const json = await response.json()
                    let errors = Object.keys(json.errors).map(key => new ServerError(key, json.errors[key]))
                    throw errors.map((error) => new Error( error.subject + " " + error.concatObjects() ))
                } else {
                    throw new Error("Unexpected error.")
                }
            } catch ( error ) {
                reject(error)
            }
        })
    }

    // // register: (form: UserForm ) => Promise<User>
    register = (username: string, email: string, password: string ) => {
        return new Promise<User>( async (resolve, reject) => {
            try {
                const response = await fetch("https://conduit.productionready.io/api/users", {
                    headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                    },
                    method: "POST",
                    body: JSON.stringify({"user": {"username": username, "email": email, "password": password}})
                })
                if ( response.status === 200 ) {
                    const json = await response.json()
                    let user = User.init(json.user)
                    resolve( user )
                } else if ( response.status === 422 ) {
                    const json = await response.json()
                    let errors = Object.keys(json.errors).map(key => new ServerError(key, json.errors[key]))
                    throw errors.map((error) => new Error( error.subject + " " + error.concatObjects() ))
                } else {
                    throw new Error("Unexpected error.")
                }
            } catch ( error ) {
                reject(error)
            }
        })
    }

    // GET {{APIURL}}/user
    getUser = (token: string ): Promise<User> => {
        return new Promise<User>( async (resolve, reject) => {
            try {
                const response = await fetch("https://conduit.productionready.io/api/user", {
                    headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "Authorization" : "Token " + token
                    },
                    method: "GET"
                })
                if ( response.status === 200 ) {
                    const json = await response.json()
                    let user = User.init(json.user)
                    resolve( user )
                } else if ( response.status === 422 ) {
                    const json = await response.json()
                    let errors = Object.keys(json.errors).map(key => new ServerError(key, json.errors[key]))
                    throw errors.map((error) => new Error( error.subject + " " + error.concatObjects() ))
                } else {
                    throw new Error("Unexpected error.")
                }
            } catch ( error ) {
                reject(error)
            }
        })
    }

    // PUT {{APIURL}}/user
    updateUser = (token: string, user: PostUser): Promise<User> => {
        return new Promise<User>( async (resolve, reject) => {
            try {
                const response = await fetch("https://conduit.productionready.io/api/user", {
                    headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "Authorization" : "Token " + token
                    },
                    method: "PUT",
                    body: JSON.stringify({"user": user.trimmed() })
                })
                if ( response.status === 200 ) {
                    const json = await response.json()
                    let user = User.init(json.user)
                    resolve( user )
                } else if ( response.status === 422 ) {
                    const json = await response.json()
                    let errors = Object.keys(json.errors).map(key => new ServerError(key, json.errors[key]))
                    throw errors.map((error) => new Error( error.subject + " " + error.concatObjects() ))
                } else {
                    throw new Error("Unexpected error.")
                }
            } catch ( error ) {
                reject(error)
            }
        })
    }


    // articles

    getArticles = ( limit?: number, offset?: number ) => {
        return this.callArticleAPI( this.buildPath("articles", this.buildArticlesQuery(limit, offset)), "GET" )
    }

    // /articles?author={ username }
    getArticlesOfAuthor = ( username: string, token?: string, limit?: number, offset?: number ) => {
        let header = null
        if (token !== null) { header = this.buildHeader( { "Authorization" : "Token " + token } ) }
        return this.callArticleAPI( this.buildPath("articles", this.buildArticlesQuery(limit, offset, null, null, username) ), "GET", header )
    }

    // /articles?favorited={ username }
    getArticlesForFavoriteUser = ( username: string, limit?: number, offset?: number ) => {
        return this.callArticleAPI( this.buildPath("articles", this.buildArticlesQuery(limit, offset, null, username) ), "GET" )
    }

    // /articles?tag={ tag }
    getArticlesOfTagged = ( tag: string, limit?: number, offset?: number ) => {
        return this.callArticleAPI( this.buildPath("articles", this.buildArticlesQuery(limit, offset, tag) ), "GET" )
    }

    // /articles/feed
    getArticlesByFollowingUser = ( token: string, limit?: number, offset?: number ) => {
        return this.callArticleAPI( this.buildPath("articles/feed", this.buildArticlesQuery(limit, offset)),
                            "GET", this.buildHeader( { "Authorization" : "Token " + token } ) )
    }

    // {{APIURL}}/articles/{{slug}}
    getArticle = ( slug: string ): Promise<Article> => {
        return new Promise<Article>( async (resolve, reject) => {
            try {
                const response = await fetch("https://conduit.productionready.io/api/articles/" + slug , {
                    headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                    },
                    method: "GET"
                })
                if ( response.status === 200 ) {
                    const json = await response.json()
                    let article = Article.init(json.article)
                    resolve( article )
                } else if ( response.status === 422 ) {
                    const json = await response.json()
                    let errors = Object.keys(json.errors).map(key => new ServerError(key, json.errors[key]))
                    throw errors.map((error) => new Error( error.subject + " " + error.concatObjects() ))
                } else {
                    throw new Error("Unexpected error.")
                }
            } catch ( error ) {
                reject(error)
            }
        })
    }

    postArticle = ( token: String, article: PostArticle ): Promise<Article> => {
        return new Promise<Article>( async (resolve, reject) => {
            try {
                const response = await fetch("https://conduit.productionready.io/api/articles", {
                    headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "Authorization" : "Token " + token
                    },
                    method: "POST",
                    body: JSON.stringify({ "article": article })
                })
                if ( response.status === 200 ) {
                    const json = await response.json()
                    let article = Article.init(json.article)
                    resolve( article )
                } else if ( response.status === 422 ) {
                    const json = await response.json()
                    let errors = Object.keys(json.errors).map(key => new ServerError(key, json.errors[key]))
                    throw errors.map((error) => new Error( error.subject + " " + error.concatObjects() ))
                } else {
                    throw new Error("Unexpected error.")
                }
            } catch ( error ) {
                reject(error)
            }
        })
    }

    // DEL {{APIURL}}/articles/{{slug}}/comments/{{commentId}}
    deleteComment = ( token: string, slug: string, commentId: number ): Promise<void> => {
        return new Promise<void>( async (resolve, reject) => {
            try {
                const response = await fetch("https://conduit.productionready.io/api/articles/" + slug + "/comments/" + commentId, {
                    headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "Authorization" : "Token " + token
                    },
                    method: "DELETE"
                })
                if ( response.status === 200 ) {
                    resolve()
                } else if ( response.status === 422 ) {
                    const json = await response.json()
                    let errors = Object.keys(json.errors).map(key => new ServerError(key, json.errors[key]))
                    throw errors.map((error) => new Error( error.subject + " " + error.concatObjects() ))
                } else {
                    throw new Error("Unexpected error.")
                }
            } catch ( error ) {
                reject(error)
            }
        })
    }

    // PUT {{APIURL}}/articles/{{slug}}
    updateArticle = ( token: string, article: PostArticle, slug: string): Promise<Article> => {
        return new Promise<Article>( async (resolve, reject) => {
            try {
                const response = await fetch("https://conduit.productionready.io/api/articles/" + slug, {
                    headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "Authorization" : "Token " + token
                    },
                    method: "PUT",
                    body: JSON.stringify({ "article": article })
                })
                if ( response.status === 200 ) {
                    const json = await response.json()
                    let article = Article.init(json.article)
                    resolve( article )
                } else if ( response.status === 422 ) {
                    const json = await response.json()
                    let errors = Object.keys(json.errors).map(key => new ServerError(key, json.errors[key]))
                    throw errors.map((error) => new Error( error.subject + " " + error.concatObjects() ))
                } else {
                    throw new Error("Unexpected error.")
                }
            } catch ( error ) {
                reject(error)
            }
        })
    }

    // DELETE {{APIURL}}/articles/{{slug}}
    deleteArticle = ( token: string, slug: string): Promise<void> => {
        return new Promise<void>( async (resolve, reject) => {
            try {
                const response = await fetch("https://conduit.productionready.io/api/articles/" + slug, {
                    headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "Authorization" : "Token " + token
                    },
                    method: "DELETE"
                })
                if ( response.status === 200 ) {
                    resolve()
                } else if ( response.status === 422 ) {
                    const json = await response.json()
                    let errors = Object.keys(json.errors).map(key => new ServerError(key, json.errors[key]))
                    throw errors.map((error) => new Error( error.subject + " " + error.concatObjects() ))
                } else {
                    throw new Error("Unexpected error.")
                }
            } catch ( error ) {
                reject(error)
            }
        })
    }

    // POST {{APIURL}}/articles/{{slug}}/favorite
    favorite = ( token: string, slug: string ): Promise<Article> => {
        return this.callArticleFavoriteAPI( token, slug, "POST")
    }

    // DEL {{APIURL}}/articles/{{slug}}/favorite
    unfavorite = ( token: string, slug: string ): Promise<Article> => {
        return this.callArticleFavoriteAPI( token, slug, "DELETE")
    }

    getComments = ( slug: string ): Promise<Comment[]> => {
        return new Promise<Comment[]>( async (resolve, reject) => {
            try {
                const response = await fetch("https://conduit.productionready.io/api/articles/" + slug + "/comments", {
                    headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                    },
                    method: "GET"
                })
                if ( response.status === 200 ) {
                    const json = await response.json()
                    let comments = json.comments.map((comment) => { return Comment.init(comment) })
                    resolve( comments )
                } else if ( response.status === 422 ) {
                    const json = await response.json()
                    let errors = Object.keys(json.errors).map(key => new ServerError(key, json.errors[key]))
                    throw errors.map((error) => new Error( error.subject + " " + error.concatObjects() ))
                } else {
                    throw new Error("Unexpected error.")
                }
            } catch ( error ) {
                reject(error)
            }
        })
    }

    // GET {{APIURL}}/profiles/{{USERNAME}}
    getProfile = ( username: string, token?: string ): Promise<Profile> => {
        let headers = {
            "Accept": "application/json",
            "Content-Type": "application/json"
            }
        if (token !== null ) { headers["Authorization"] = "Token " + token }
        return new Promise<Profile>( async (resolve, reject) => {
            try {
                const response = await fetch("https://conduit.productionready.io/api/profiles/" + username, {
                    headers: headers
                })
                if ( response.status === 200 ) {
                    const json = await response.json()
                    let profile = Profile.init(json.profile)
                    resolve( profile )
                } else if ( response.status === 422 ) {
                    const json = await response.json()
                    let errors = Object.keys(json.errors).map(key => new ServerError(key, json.errors[key]))
                    throw errors.map((error) => new Error( error.subject + " " + error.concatObjects() ))
                } else {
                    throw new Error("Unexpected error.")
                }
            } catch ( error ) {
                reject(error)
            }
        })
    }

    follow = ( token: string, username: string ): Promise<Profile> => {
        return this.callUserFollowAPI(token, username, "POST")
    }

    unfollow = ( token: string, username: string ): Promise<Profile> => {
        return this.callUserFollowAPI(token, username, "DELETE")
    }

    // // Tags
    getTags = () => {
        return new Promise<string[]>( async (resolve, reject) => {
            try {
                const response = await fetch("https://conduit.productionready.io/api/tags", {
                    headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                    },
                    method: "GET"
                })

                const json = await response.json()
                resolve( json.tags )
            } catch (error) {
                reject(error)
            }
        })
    }

    // Comment

    // POST {{APIURL}}/articles/{{slug}}/comments
    postComment = ( token: string, slug: string, comment: string ): Promise<Comment> => {
        return new Promise<Comment>( async (resolve, reject) => {
            try {
                const response = await fetch("https://conduit.productionready.io/api/articles/" + slug + "/comments" , {
                    headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "Authorization" : "Token " + token
                    },
                    method: "POST",
                    body: JSON.stringify({ "comment": { "body": comment } })
                })
                if ( response.status === 200 ) {
                    const json = await response.json()
                    let comment = Comment.init(json.comment)
                    resolve( comment )
                } else if ( response.status === 422 ) {
                    const json = await response.json()
                    let errors = Object.keys(json.errors).map(key => new ServerError(key, json.errors[key]))
                    throw errors.map((error) => new Error( error.subject + " " + error.concatObjects() ))
                } else {
                    throw new Error("Unexpected error.")
                }
            } catch ( error ) {
                reject(error)
            }
        })
    }

    // Privates

    private callUserFollowAPI = ( token: string, username: string, method: string ) => {
        return new Promise<Profile>( async (resolve, reject) => {
            try {
                const response = await fetch("https://conduit.productionready.io/api/profiles/" + username + "/follow", {
                    headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "Authorization" : "Token " + token
                    },
                    method: method
                })
                if ( response.status === 200 ) {
                    const json = await response.json()
                    let profile = Profile.init(json.profile)
                    resolve( profile )
                } else if ( response.status === 422 ) {
                    const json = await response.json()
                    let errors = Object.keys(json.errors).map(key => new ServerError(key, json.errors[key]))
                    throw errors.map((error) => new Error( error.subject + " " + error.concatObjects() ))
                } else {
                    throw new Error("Unexpected error.")
                }
            } catch ( error ) {
                reject(error)
            }
        })
    }

    private callArticleFavoriteAPI = ( token: string, slug: string, method: string ) => {
        return new Promise<Article>( async (resolve, reject) => {
            try {
                const response = await fetch("https://conduit.productionready.io/api/articles/" + slug + "/favorite", {
                    headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "Authorization" : "Token " + token
                    },
                    method: method
                })
                if ( response.status === 200 ) {
                    const json = await response.json()
                    let article = Article.init(json.article)
                    resolve( article )
                } else if ( response.status === 422 ) {
                    const json = await response.json()
                    let errors = Object.keys(json.errors).map(key => new ServerError(key, json.errors[key]))
                    throw errors.map((error) => new Error( error.subject + " " + error.concatObjects() ))
                } else {
                    throw new Error("Unexpected error.")
                }
            } catch ( error ) {
                reject(error)
            }
        })
    }
    // // getUser: (token: string ) => Promise<User>
    // getUser = (token: string ) => {
    //     return new Promise<User>( async () => {
    //         return new User()
    //     })
    // }
    // // <<要調査>>// putUser: (token: ) => Promise<User>

    // // Articles
    private callArticleAPI = ( endpoint: string, method: string, headers?: {[key: string]: string }) => {
        return new Promise<ArticleContainer>( async (resolve, reject) => {
            try {
                const response = await fetch("https://conduit.productionready.io/api/" + endpoint, {
                    headers: headers,
                    method: method
                })

                const json = await response.json()
                let container = new ArticleContainer( json.articlesCount, json.articles)
                resolve( container )
            } catch (error) {
                reject(error)
            }
        })
    }

    private buildHeader = ( addtionalHeaders?:  {[key: string]: string } ) => {
        let headers = {
            "Accept": "application/json",
            "Content-Type": "application/json"
        }
        if ( addtionalHeaders == null ) { return headers }
        return Object.assign(headers, addtionalHeaders)
    }

    private buildPath = ( application: string, queries?:  {[key: string]: string } ) => {
        let path = application
        if ( queries != null ) {
            let concated = "?"
            Object.keys(queries).forEach((key, index, keys) => {
                concated += key + "=" + queries[key]
                if (index !== keys.length - 1) { concated += "&" }
            })
            if (concated.length > 0) { path += concated }
        }
        return path
    }

    private buildArticlesQuery = (limit?: number, offset?: number, tag?: string, favorited?: string, author?: string) => {
        if (tag == null && favorited == null && author == null && offset == null && limit == null) { return null }
        let queries = {}
        if (offset != null && offset > 0 ) { queries["offset"] = offset.toString() }
        if (limit != null && limit > 0 ) { queries["limit"] = limit.toString() }
        if (tag != null) { queries["tag"] = tag }
        else if (favorited != null) { queries["favorited"] = favorited }
        else if (author != null) { queries["author"] = author }
        return queries
    }
}
