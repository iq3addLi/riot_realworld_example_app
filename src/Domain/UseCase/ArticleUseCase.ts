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

    // Public
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
        const token = this.storage.user() == null ? null : this.storage.user().token
        return this.conduit.getArticle( this.state.slug, token).then( (article) => {
            this._article = article
            return article
        })
    }

    currentArticle = () => {
        return this._article
    }

    currentComments = () => {
        return this._comments
    }

    requestComments = () => {
        return this.conduit.getComments( this.state.slug ).then( (comments) => {
            this._comments = comments
            return comments
        })
    }

    toggleFollowing = () => {
        const article = this._article
        if ( article === null ) { throw Error("An article is empty.") }
        // follow/unfollow
        const token = this.storage.user().token
        const username = article.author.username
        const process = ( p ) => { this._article.author = p; return p }
        switch (article.author.following) {
        case true:  return this.conduit.unfollow( token, username ).then( process )
        case false: return this.conduit.follow( token, username ).then( process )
        }
    }

    toggleFavorite = (): Promise<Article> => {
        const article = this._article
        if ( article === null ) { throw Error("An article is empty.")  }
        const token = this.storage.user().token
        const process = ( a ) => { this._article = a; return a }
        const favorited = article.favorited
        switch (favorited) {
        case true:  return this.conduit.unfavorite( token, this.state.slug ).then( process )
        case false: return this.conduit.favorite( token, this.state.slug ).then( process )
        }
    }

    postComment = ( comment: string ) => {
        const token = this.storage.user().token
        return this.conduit.postComment( token, this.state.slug, comment ).then( (comment) => {
            this._comments.unshift(comment)
            return comment
        })
    }

    deleteComment = ( commentId: number ) => {
        const token = this.storage.user().token
        return this.conduit.deleteComment(token, this.state.slug, commentId).then( () => {
            let index = this._comments.findIndex( ( target ) => target.id === commentId )
            this._comments.splice(index, 1)
        })
    }

    deleteArticle = () => {
        const token = this.storage.user().token
        return this.conduit.deleteArticle( token, this.state.slug )
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
    slug: string

    constructor( location: SPALocation ) {
        // scene
        this.scene = location.scene()
        // slug
        this.slug = location.paths()[0]
    }
}
