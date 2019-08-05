import UserLocalStorageRepository from "../Repository/UserLocalStorageRepository"
import ConduitProductionRepository from "../Repository/ConduitProductionRepository"
import Article from "../Model/Article"
import SPALocation from "../../Infrastructure/SPALocation"
import Comment from "../Model/Comment"
import SPAPathBuilder from "../../Infrastructure/SPAPathBuilder"
import MenuItemsBuilder from "../Utility/MenuItemsBuilder"

export default class ArticleUseCase {

    private conduit = new ConduitProductionRepository()
    private storage = new UserLocalStorageRepository()

    private _article?: Article = null
    private _comments: Comment[] = []
    private state: ArticleState

    constructor() {
        this.state = new ArticleState( SPALocation.shared() )
    }

    isLoggedIn = () => {
        return this.storage.isLoggedIn()
    }

    loggedUser = () => {
        return this.storage.user()
    }

    menuItems = () => {
        return new MenuItemsBuilder().items( this.state.scene, this.storage.user() )
    }

    loggedUserProfile = () => {
        return this.storage.user().profile()
    }

    requestArticle = () => {
        let slug = SPALocation.shared().paths()[0]
        let token = this.storage.user() == null ? null : this.storage.user().token
        if (slug !== null) {
            return this.conduit.getArticle(slug, token).then( (article) => {
                this._article = article
                return article
            })
        }
    }

    currentArticle = () => {
        return this._article
    }

    currentComments = () => {
        return this._comments
    }

    requestComments = () => {
        let slug = SPALocation.shared().paths()[0]
        return this.conduit.getComments(slug).then( (comments) => {
            this._comments = comments
            return comments
        })
    }

    toggleFollowing = () => {
        let article = this._article
        if ( article === null ) { throw Error("An article is empty.") }
        // follow/unfollow
        let token = this.storage.user().token
        let username = article.author.username
        let process = ( p ) => { this._article.author = p; return p }
        switch (article.author.following) {
        case true:  return this.conduit.unfollow( token, username ).then( process )
        case false: return this.conduit.follow( token, username ).then( process )
        }
    }

    toggleFavorite = (): Promise<Article> => {
        let article = this._article
        if ( article === null ) { throw Error("Article is empty.")  }
        let token = this.storage.user().token
        let slug = SPALocation.shared().paths()[0]
        let process = ( a ) => { this._article = a; return a }
        let favorited = article.favorited
        switch (favorited) {
        case true:  return this.conduit.unfavorite( token, slug ).then( process )
        case false: return this.conduit.favorite( token, slug ).then( process )
        }
    }

    postComment = ( comment: string ) => {
        let token = this.storage.user().token
        let slug = SPALocation.shared().paths()[0]
        return this.conduit.postComment( token, slug, comment ).then( (comment) => {
            this._comments.unshift(comment)
            return comment
        })
    }

    deleteComment = ( commentId: number ) => {
        let token = this.storage.user().token
        let slug = SPALocation.shared().paths()[0]
        return this.conduit.deleteComment(token, slug, commentId).then( () => {
            let index = this._comments.findIndex( ( target ) => target.id === commentId )
            this._comments.splice(index, 1)
        })
    }

    deleteArticle = () => {
        let token = this.storage.user().token
        let slug = SPALocation.shared().paths()[0]
        return this.conduit.deleteArticle( token, slug )
    }

    jumpToEditerScene = () => {
        location.href = new SPAPathBuilder("editer", [this._article.slug]).fullPath()
    }

    jumpToHome = () => {
        location.href = "/"
    }
}

class ArticleState {
    scene: string

    constructor( location: SPALocation ) {
        // scene
        this.scene = location.scene()
    }
}
