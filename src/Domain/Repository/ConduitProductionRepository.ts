import ConduitRepository from "./interface/ConduitRepository"
import User from "../Model/User"
import Article from "../Model/Article"
import Comment from "../Model/Comment"
import Profile from "../Model/Profile"
import UserForm from "../Model/UserForm"
import ServerError from "../Model/ServerError"
import ArticleContainer from "../Model/ArticleContainer"

export default class ConduitProductionRepository implements ConduitRepository {

    // Users
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

    // /articles
    getArticles = ( limit?: number, offset?: number ) => {
        return this.callArticleAPI( this.buildPath("articles", this.buildArticlesQuery(limit, offset)), "GET" )
    }

    // /articles?author={ username }
    getArticlesOfAuthor = ( author: string, limit?: number, offset?: number ) => {
        return this.callArticleAPI( this.buildPath("articles", this.buildArticlesQuery(limit, offset, null, null, author) ), "GET" )
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

    // getArticle: (slug: string) => Promise<Article>

    // postArticle: ( token: String, article: Article ) => Promise<boolean>
    // putArticle: (slug: string) => Promise<boolean>
    // deleteArticle: (slug: string) => Promise<boolean>

    // favorite: ( slug: string ) => Promise<boolean>
    // unfavorite: ( slug: string ) => Promise<boolean>

    // getComments: ( slug: string ) => Promise<Comment[]>
    // postComment: ( token: string, message: string ) => Promise<boolean>
    // deleteComment: ( token: string ) => Promise<boolean>

    // // Profiles
    // getProfile: ( token: string, message: string ) => Promise<Profile>
    // follow: ( token: string, username: string ) => Promise<boolean>
    // unfollow: ( token: string, username: string ) => Promise<boolean>

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
    // // getUser: (token: string ) => Promise<User>
    // getUser = (token: string ) => {
    //     return new Promise<User>( async () => {
    //         return new User()
    //     })
    // }
    // // <<要調査>>// putUser: (token: ) => Promise<User>

    // // Articles
    private callArticleAPI = ( endpoint: string, method: string, headers?: {[key: string]: string } ) => {
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
