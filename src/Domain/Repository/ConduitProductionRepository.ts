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
    // // getUser: (token: string ) => Promise<User>
    // getUser = (token: string ) => {
    //     return new Promise<User>( async () => {
    //         return new User()
    //     })
    // }
    // // <<要調査>>// putUser: (token: ) => Promise<User>

    // // Articles
    getArticles = () => {
        return new Promise<ArticleContainer>( async (resolve, reject) => {
            try {
                const response = await fetch("https://conduit.productionready.io/api/articles", {
                    headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                    },
                    method: "GET"
                })

                const json = await response.json()
                let container = new ArticleContainer( json.articleCount, json.articles)
                resolve( container )
            } catch (error) {
                reject(error)
            }
        })
    }

    // postArticle: ( token: String, article: Article ) => Promise<boolean>
    // getArticlesForUser: ( username: string ) => Promise<Article[]>
    // getArticlesForFavoriteUser: ( username: string ) => Promise<Article[]>
    // getArticlesOfTagged: (tag: string ) => Promise<Article[]>
    // getArticlesByFollowingUser: ( token: String ) => Promise<Article[]>

    // getArticle: (slug: string) => Promise<Article>
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
}
