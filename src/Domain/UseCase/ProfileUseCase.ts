import UserLocalStorageRepository from "../Repository/UserLocalStorageRepository"
import Profile from "../Model/Profile"
import Article from "../Model/Article"
import ArticleContainer from "../Model/ArticleContainer"
import SPALocation from "../../Infrastructure/SPALocation"
import Settings from "../../Infrastructure/Settings"
import ArticleTabItem from "../Model/ArticleTabItem"
import SPAPathBuilder from "../../Infrastructure/SPAPathBuilder"
import ConduitProductionRepository from "../Repository/ConduitProductionRepository"
import MenuItemsBuilder from "../Utility/MenuItemsBuilder"

export default class ProfileUseCase {

    private conduit = new ConduitProductionRepository()
    private storage = new UserLocalStorageRepository()

    private profile?: Profile
    private currentArticle?: ArticleContainer = null
    private state: ProfileState

    constructor() {
        this.state = new ProfileState( SPALocation.shared() )
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

    isOwnedProfile = () => {
        return this.storage.user().username === this.profile.username
    }

    requestProfile = () => {
        let token = this.storage.user().token
        return this.conduit.getProfile( this.state.username, token ).then( ( p ) => { this.profile = p; return p } )
    }

    requestArticles = () => {
        // calc offset
        let limit: number = Settings.shared().valueForKey("countOfArticleInView")
        let page = this.currentPage()
        let offset = page == null ? null : (page - 1) * limit

        // prepare request
        let token = this.storage.user().token
        let nextProcess = ( c ) => { this.currentArticle = c; return c }

        // request
        switch (this.state.articleKind) {
        case "favorite_articles": return this.conduit.getArticlesForFavoriteUser(this.state.username, token, limit, offset).then( nextProcess ); break
        default: return this.conduit.getArticlesOfAuthor(this.state.username, token, limit, offset).then( nextProcess ); break
        }
    }

    pageCount = () => {
        if (this.currentArticle == null || this.currentArticle.count === 0) {
            return 0
        }
        let limit: number = Settings.shared().valueForKey("countOfArticleInView")
        return Math.floor(this.currentArticle.count / limit)
    }

    currentPage = () => {
        return this.state.page
    }

    tabItems = () => {
        let tabs: ArticleTabItem[] = [
            new ArticleTabItem( "my_articles", "My Articles", (this.state.articleKind === "my_articles")) ,
            new ArticleTabItem( "favorite_articles", "Favorite Articles", (this.state.articleKind  === "favorite_articles"))
        ]
        return tabs
    }

    toggleFollowing = () => {
        let profile = this.profile
        if ( profile === null ) { throw Error("A profile is empty.") }
        // follow/unfollow
        let token = this.storage.user().token
        let username = profile.username
        let process = ( p ) => { this.profile = p; return p }
        switch (profile.following) {
        case true:  return this.conduit.unfollow( token, username ).then( process )
        case false: return this.conduit.follow( token, username ).then( process )
        }
    }

    jumpPage = (page: number) => {
        let pathBuilder = new SPAPathBuilder(this.state.scene, [this.state.username, this.state.articleKind], { "page" : String(page) } )
        // page transition
        location.href = pathBuilder.fullPath()
    }

    jumpPageBySubPath = (path: string) => {
        let pathBuilder = new SPAPathBuilder(this.state.scene, [this.state.username, path])
        // page transition
        location.href = pathBuilder.fullPath()
    }

    jumpToSettingScene = () => {
        // page transition
        location.href = new SPAPathBuilder("settings").fullPath()
    }

    jumpPageByProfile  = (profile: Profile ) => {
        // page transition
        location.href = new SPAPathBuilder("profile", [profile.username]).fullPath()
    }

    jumpPageByArticle = (article: Article) => {
        // page transition
        location.href = new SPAPathBuilder("article", [article.slug]).fullPath()
    }

}


class ProfileState {
    scene: string
    username: string
    articleKind: string
    page: number

    constructor( location: SPALocation ) {

        // scene
        this.scene = location.scene()

        // username
        let paths = location.paths()
        if ( paths.length >= 1 ) {
            this.username = paths[0]
        } else {
            throw Error("A username is can't empty in this scene.")
        }

        // articleKind
        this.articleKind =  ( paths.length === 2 ) ? paths[1] : "my_articles"
        if ( paths.length >= 3 ) {
            throw Error("Unexpected query of http.")
        }

        // page
        switch ( location.query() ) {
        case undefined: case null: this.page = 1; break
        default:
            let page = location.query()["page"]
            if ( page === undefined || page == null ) { this.page = 1 }
            else { this.page = Number(page) }
        }
    }
}
