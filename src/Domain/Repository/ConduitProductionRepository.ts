import ConduitRepository from "./interface/ConduitRepository"
import User from "../Model/User"
import Article from "../Model/Article"
import PostArticle from "../Model/PostArticle"
import Comment from "../Model/Comment"
import Profile from "../Model/Profile"
import ServerError from "../Model/ServerError"
import ArticleContainer from "../Model/ArticleContainer"
import PostUser from "../Model/PostUser"
import Settings from "../../Infrastructure/Settings"

export default class ConduitProductionRepository implements ConduitRepository {

    private _endpoint = null

    login = (email: string, password: string ) => {
        return this.fetchingPromise( "/users/login", "POST", this.headers(), {"user": {"email": email, "password": password}}).then( json => User.init(json.user) )
    }

    register = (username: string, email: string, password: string ) => {
        return this.fetchingPromise( "/users", "POST", this.headers(), {"user": {"username": username, "email": email, "password": password}}).then( json => User.init(json.user) )
    }

    getUser = (token: string ) => {
        return this.fetchingPromise( "/user", "GET", this.headers( token ), null).then( json => User.init(json.user) )
    }

    updateUser = (token: string, user: PostUser) => {
        return this.fetchingPromise( "/user", "PUT", this.headers( token ), {"user": user.trimmed() }).then( json => User.init(json.user) )
    }

    getArticles = ( token?: string, limit?: number, offset?: number ) => {
        return this.getArticleContainer( this.buildPath("/articles", this.buildArticlesQuery(limit, offset)), "GET", this.headers( token ) )
    }

    getArticlesOfAuthor = ( username: string, token?: string, limit?: number, offset?: number ) => {
        return this.getArticleContainer( this.buildPath("/articles", this.buildArticlesQuery(limit, offset, null, null, username) ), "GET", this.headers( token ) )
    }

    getArticlesForFavoriteUser = ( username: string, token?: string, limit?: number, offset?: number ) => {
        return this.getArticleContainer( this.buildPath("/articles", this.buildArticlesQuery(limit, offset, null, username) ), "GET", this.headers( token ) )
    }

    getArticlesOfTagged = ( tag: string, token?: string, limit?: number, offset?: number ) => {
        return this.getArticleContainer( this.buildPath("/articles", this.buildArticlesQuery(limit, offset, tag) ), "GET", this.headers( token ) )
    }

    getArticlesByFollowingUser = ( token: string, limit?: number, offset?: number ) => {
        return this.getArticleContainer( this.buildPath("/articles/feed", this.buildArticlesQuery(limit, offset)), "GET", this.headers( token ) )
    }

    getArticle = ( slug: string, token?: string ) => {
        return this.fetchingPromise( "/articles/" + slug, "GET", this.headers( token ) ).then( json => Article.init(json.article) )
    }

    postArticle = ( token: string, article: PostArticle ) => {
        return this.fetchingPromise( "/articles/", "POST", this.headers( token ), { "article": article } ).then( json => Article.init(json.article) )
    }

    updateArticle = ( token: string, article: PostArticle, slug: string) => {
        return this.fetchingPromise( "/articles/" + slug, "PUT", this.headers( token ), { "article": article } ).then( json => Article.init(json.article) )
    }

    deleteArticle = ( token: string, slug: string) => {
        return this.fetchingPromise( "/articles/" + slug, "DELETE", this.headers( token ))
    }

    favorite = ( token: string, slug: string ): Promise<Article> => {
        return this.fetchingPromise( "/articles/" + slug + "/favorite", "POST", this.headers( token )).then( json => Article.init(json.article))
    }

    unfavorite = ( token: string, slug: string ): Promise<Article> => {
        return this.fetchingPromise( "/articles/" + slug + "/favorite", "DELETE", this.headers( token )).then( json => Article.init(json.article))
    }

    getComments = ( slug: string ): Promise<Comment[]> => {
        return this.fetchingPromise( "/articles/" + slug + "/comments", "GET", this.headers()).then( json => json.comments.map( comment => Comment.init(comment) ))
    }

    postComment = ( token: string, slug: string, comment: string ): Promise<Comment> => {
        return this.fetchingPromise( "/articles/" + slug + "/comments", "POST", this.headers( token ), { "comment": { "body": comment } } ).then( json => Comment.init(json.comment))
    }

    deleteComment = ( token: string, slug: string, commentId: number ) => {
        return this.fetchingPromise( "/articles/" + slug + "/comments/" + commentId, "DELETE", this.headers( token ) )
    }

    getProfile = ( username: string, token?: string ) => {
        return this.fetchingPromise( "/profiles/" + username, "GET", this.headers(token)).then( json => Profile.init(json.profile) )
    }

    follow = ( token: string, username: string ): Promise<Profile> => {
        return this.fetchingPromise( "/profiles/" + username + "/follow", "POST", this.headers(token)).then( json => Profile.init(json.profile))
    }

    unfollow = ( token: string, username: string ): Promise<Profile> => {
        return this.fetchingPromise( "/profiles/" + username + "/follow", "DELETE", this.headers(token)).then( json => Profile.init(json.profile))
    }

    getTags = () => {
        return this.fetchingPromise( "/tags", "GET", this.headers()).then( json => json.tags )
    }

    // Privates

    private endpoint = () => {
        if ( this._endpoint == null ) {
            this._endpoint = Settings.shared().valueForKey("endpoint")
        }
        return this._endpoint
    }

    private getArticleContainer = ( path: string, method: string, headers?: {[key: string]: string }) => {
        return this.fetchingPromise( path, method, headers ).then( json => new ArticleContainer( json.articlesCount, json.articles ))
    }

    private headers = ( token?: string ) => {
        let headers = {
            "Accept": "application/json",
            "Content-Type": "application/json"
        }
        if ( token != null ) { headers["Authorization"] = "Token " + token }
        return headers
    }

    private buildPath = ( scene: string, queries?:  {[key: string]: string } ) => {
        let path = scene
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

    private evaluateResponse = async( response: Response, successHandler: (json: any) => void, failureHandler: ( error: Error|Error[]) => void ) => {
        if ( response.status === 200 ) {
            successHandler( await response.json() )
        } else if ( response.status === 422 ) {
            const json = await response.json()
            const errors = Object.keys(json.errors).map(key => new ServerError(key, json.errors[key]))
            failureHandler( errors.map((error) => new Error( error.subject + " " + error.concatObjects() )) )
        } else {
            failureHandler( new Error("Unexpected error. code=" + response.status ) )
        }
    }

    private fetchingPromise = (path: string, method: string, headers?: {[key: string]: string }, body?: object ) => {
        const init = { "method": method }
        if ( headers != null ) { init["headers"] = headers }
        if ( body != null ) { init["body"] = JSON.stringify(body) }
        return new Promise<any>( async (resolve, reject) => {
            const response = await fetch( this.endpoint() + path, init)
            this.evaluateResponse( response,
                json  => { resolve( json ) },
                error => { reject( error ) }
            )
        })
    }
}
