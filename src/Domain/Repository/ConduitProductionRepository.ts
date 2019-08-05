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

    private endpoint = Settings.shared().valueForKey("endpoint")

    login = (email: string, password: string ) => {
        return new Promise<User>( async (resolve, reject) => {
            const response = await fetch( this.endpoint + "/users/login", {
                method: "POST",
                headers: this.buildHeader(),
                body: JSON.stringify({"user": {"email": email, "password": password}})
            })
            this.evaluateResponse(response, ( json ) => {
                resolve( User.init(json.user) )
            }, error => { reject(error) } )
        })
    }

    register = (username: string, email: string, password: string ) => {
        return new Promise<User>( async (resolve, reject) => {
            const response = await fetch( this.endpoint + "/users", {
                method: "POST",
                headers: this.buildHeader(),
                body: JSON.stringify({"user": {"username": username, "email": email, "password": password}})
            })
            this.evaluateResponse(response, ( json ) => {
                resolve( User.init(json.user) )
            }, error => { reject(error) } )
        })
    }

    getUser = (token: string ): Promise<User> => {
        return new Promise<User>( async (resolve, reject) => {
            const response = await fetch( this.endpoint + "/user", { headers: this.buildHeader( token ) })
            this.evaluateResponse(response, ( json ) => {
                resolve( User.init(json.user) )
            }, error => { reject(error) } )
        })
    }

    updateUser = (token: string, user: PostUser): Promise<User> => {
        return new Promise<User>( async (resolve, reject) => {
            const response = await fetch( this.endpoint + "/user", {
                method: "PUT",
                headers: this.buildHeader( token ),
                body: JSON.stringify({"user": user.trimmed() })
            })
            this.evaluateResponse(response, ( json ) => {
                resolve( User.init(json.user) )
            }, error => { reject(error) } )
        })
    }

    getArticles = ( token?: string, limit?: number, offset?: number ) => {
        return this.callArticleAPI( this.buildArticlePath("articles", this.buildArticlesQuery(limit, offset)), "GET", this.buildHeader( token ) )
    }

    getArticlesOfAuthor = ( username: string, token?: string, limit?: number, offset?: number ) => {
        return this.callArticleAPI( this.buildArticlePath("articles", this.buildArticlesQuery(limit, offset, null, null, username) ), "GET", this.buildHeader( token ) )
    }

    getArticlesForFavoriteUser = ( username: string, token?: string, limit?: number, offset?: number ) => {
        return this.callArticleAPI( this.buildArticlePath("articles", this.buildArticlesQuery(limit, offset, null, username) ), "GET", this.buildHeader( token ) )
    }

    getArticlesOfTagged = ( tag: string, token?: string, limit?: number, offset?: number ) => {
        return this.callArticleAPI( this.buildArticlePath("articles", this.buildArticlesQuery(limit, offset, tag) ), "GET", this.buildHeader( token ) )
    }

    getArticlesByFollowingUser = ( token: string, limit?: number, offset?: number ) => {
        return this.callArticleAPI( this.buildArticlePath("articles/feed", this.buildArticlesQuery(limit, offset)), "GET", this.buildHeader( token ) )
    }

    getArticle = ( slug: string, token?: string ): Promise<Article> => {
        return new Promise<Article>( async (resolve, reject) => {
            const response = await fetch( this.endpoint + "/articles/" + slug , {
                headers: this.buildHeader( token )
            })
            this.evaluateResponse(response, ( json ) => {
                resolve( Article.init(json.article) )
            }, error => { reject(error) } )
        })
    }

    postArticle = ( token: string, article: PostArticle ): Promise<Article> => {
        return new Promise<Article>( async (resolve, reject) => {
            const response = await fetch( this.endpoint + "/articles", {
                method: "POST",
                headers: this.buildHeader( token ),
                body: JSON.stringify({ "article": article })
            })
            this.evaluateResponse(response, ( json ) => {
                resolve( Article.init(json.article) )
            }, error => { reject(error) } )
        })
    }

    deleteComment = ( token: string, slug: string, commentId: number ): Promise<void> => {
        return new Promise<void>( async (resolve, reject) => {
            const response = await fetch( this.endpoint + "/articles/" + slug + "/comments/" + commentId, {
                method: "DELETE",
                headers: this.buildHeader( token )
            })
            this.evaluateResponse(response, ( _ ) => {
                resolve()
            }, error => { reject(error) } )
        })
    }

    updateArticle = ( token: string, article: PostArticle, slug: string): Promise<Article> => {
        return new Promise<Article>( async (resolve, reject) => {
            const response = await fetch( this.endpoint + "/articles/" + slug, {
                method: "PUT",
                headers: this.buildHeader( token ),
                body: JSON.stringify({ "article": article })})
            this.evaluateResponse(response, ( json ) => {
                resolve( Article.init(json.article) )
            }, error => { reject(error) } )
        })
    }

    deleteArticle = ( token: string, slug: string): Promise<void> => {
        return new Promise<void>( async (resolve, reject) => {
            const response = await fetch( this.endpoint + "/articles/" + slug, {
                headers: this.buildHeader( token ),
                method: "DELETE"
            })
            this.evaluateResponse(response, ( _ ) => {
                resolve()
            }, error => { reject(error) } )
        })
    }

    favorite = ( token: string, slug: string ): Promise<Article> => {
        return this.callArticleFavoriteAPI( token, slug, "POST")
    }

    unfavorite = ( token: string, slug: string ): Promise<Article> => {
        return this.callArticleFavoriteAPI( token, slug, "DELETE")
    }

    getComments = ( slug: string ): Promise<Comment[]> => {
        return new Promise<Comment[]>( async (resolve, reject) => {
            const response = await fetch( this.endpoint + "/articles/" + slug + "/comments", { headers: this.buildHeader() })
            this.evaluateResponse(response, ( json ) => {
                resolve( json.comments.map((comment) => { return Comment.init(comment) }) )
            }, error => { reject(error) } )
        })
    }

    getProfile = ( username: string, token?: string ): Promise<Profile> => {
        return new Promise<Profile>( async (resolve, reject) => {
            const response = await fetch( this.endpoint + "/profiles/" + username, { headers: this.buildHeader( token )})
            this.evaluateResponse(response, ( json ) => {
                resolve( Profile.init(json.profile) )
            }, error => { reject(error) } )
        })
    }

    follow = ( token: string, username: string ): Promise<Profile> => {
        return this.callUserFollowAPI(token, username, "POST")
    }

    unfollow = ( token: string, username: string ): Promise<Profile> => {
        return this.callUserFollowAPI(token, username, "DELETE")
    }

    getTags = () => {
        return new Promise<string[]>( async (resolve, reject) => {
            try {
                const response = await fetch( this.endpoint + "/tags", { headers:  this.buildHeader() })
                const json = await response.json()
                resolve( json.tags )
            } catch (error) {
                reject(error)
            }
        })
    }

    postComment = ( token: string, slug: string, comment: string ): Promise<Comment> => {
        return new Promise<Comment>( async (resolve, reject) => {
            const response = await fetch( this.endpoint + "/articles/" + slug + "/comments" , {
                headers: this.buildHeader( token ),
                method: "POST",
                body: JSON.stringify({ "comment": { "body": comment } })
            })
            this.evaluateResponse(response, ( json ) => {
                resolve( Comment.init(json.comment) )
            }, error => { reject(error) } )
        })
    }

    // Privates

    private callUserFollowAPI = ( token: string, username: string, method: string ) => {
        return new Promise<Profile>( async (resolve, reject) => {
            const response = await fetch( this.endpoint + "/profiles/" + username + "/follow", { headers: this.buildHeader( token ), method: method })
            this.evaluateResponse(response, ( json ) => {
                resolve( Profile.init(json.profile) )
            }, error => { reject(error) } )
        })
    }

    private callArticleFavoriteAPI = ( token: string, slug: string, method: string ) => {
        return new Promise<Article>( async (resolve, reject) => {
            const response = await fetch( this.endpoint + "/articles/" + slug + "/favorite", { headers: this.buildHeader( token ), method: method })
            this.evaluateResponse(response, ( json ) => {
                resolve( Article.init(json.article) )
            }, error => { reject(error) } )
        })
    }

    private callArticleAPI = ( path: string, method: string, headers?: {[key: string]: string }) => {
        return new Promise<ArticleContainer>( async (resolve, reject) => {
            try {
                const response = await fetch( this.endpoint + "/" + path, { headers: headers, method: method })
                const json = await response.json()
                let container = new ArticleContainer( json.articlesCount, json.articles )
                resolve( container )
            } catch (error) {
                reject(error)
            }
        })
    }

    private buildHeader = ( token?: string ) => {
        let headers = {
            "Accept": "application/json",
            "Content-Type": "application/json"
        }
        if ( token == null ) { return headers }
        return Object.assign(headers, { "Authorization" : "Token " + token } )
    }

    private buildArticlePath = ( scene: string, queries?:  {[key: string]: string } ) => {
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
            let json = await response.json()
            let errors = Object.keys(json.errors).map(key => new ServerError(key, json.errors[key]))
            failureHandler( errors.map((error) => new Error( error.subject + " " + error.concatObjects() )) )
        } else {
            failureHandler( new Error("Unexpected error.　code=" + response.status ) )
        }
    }
}
