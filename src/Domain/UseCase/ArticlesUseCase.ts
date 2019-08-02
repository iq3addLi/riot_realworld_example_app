import Article from "../Model/Article"
import Profile  from "../Model/Profile"

import ConduitProductionRepository from "../Repository/ConduitProductionRepository"
import UserLocalStorageRepository from "../Repository/UserLocalStorageRepository"
import SPALocation from "../../Infrastructure/SPALocation"
import Settings from "../../Infrastructure/Settings"
import SPAPathBuilder from "../../Infrastructure/SPAPathBuilder"
import ArticleContainer from "../Model/ArticleContainer"
import ArticleTabItem from "../Model/ArticleTabItem"
import MenuItemsBuilder from "../Utility/MenuItemsBuilder"

export default class ArticlesUseCase {

    private conduit = new ConduitProductionRepository()
    private storage = new UserLocalStorageRepository()

    private container?: ArticleContainer = null
    private state: ArticlesState

    constructor() {
        this.state = new ArticlesState( SPALocation.shared() )
    }

    requestArticles = () => {
        let limit: number = Settings.shared().valueForKey("countOfArticleInView")
        let offset = this.state.page == null ? null : (this.state.page - 1) * limit
        let nextProcess = (c) => { this.container = c; return c }
        let token = this.storage.user() === null ? null : this.storage.user().token

        switch (this.state.kind) {
        case "your":
            return this.conduit.getArticlesByFollowingUser( token, limit, offset).then( nextProcess )
        case "tag":
            return this.conduit.getArticlesOfTagged( this.state.tag, token, limit, offset).then( nextProcess )
        case "global":
        default:
            return this.conduit.getArticles(token, limit, offset).then( nextProcess )
        }
    }

    requestTags = () => {
        return this.conduit.getTags()
    }

    isLoggedIn = () => {
        return this.storage.isLoggedIn()
    }

    loggedUser = () => {
        return this.storage.user()
    }

    pageCount = () => {
        if (this.container == null || this.container.count === 0) {
            return 0
        }
        let limit: number = Settings.shared().valueForKey("countOfArticleInView")
        return Math.floor(this.container.count / limit)
    }

    currentPage = () => {
        return this.state.page
    }

    menuItems = () => {
        return new MenuItemsBuilder().items( this.state.scene, this.storage.user() )
    }

    tabItems = () => {
        let tabs: ArticleTabItem[] = []

        // Add "Your feed" ?
        if ( this.isLoggedIn() ) {
            tabs.push( new ArticleTabItem( "your", "Your Feed", ( this.state.kind === "your")) )
        }
        // Add "Global feed"
        tabs.push( new ArticleTabItem( "global", "Global Feed", ( this.state.kind === "global")) )

        // Add "# {tag}" ?
        if ( this.state.kind === "tag" ) {
            let tag = this.state.tag
            if (tag != null) {
                tabs.push( new ArticleTabItem( "tag", "# " + tag, true) )
            }
        }
        return tabs
    }

    jumpPage = (page: number) => {
        let path = new SPAPathBuilder( this.state.scene, SPALocation.shared().paths(), { "page" : String(page) } ).fullPath()
        location.href = path
    }

    jumpToSubPath = (path: string) => {
        let full = new SPAPathBuilder( this.state.scene, [path]).fullPath()
        location.href = full
    }

    jumpToProfileScene  = (profile: Profile ) => {
        location.href = new SPAPathBuilder("profile", [profile.username]).fullPath()
    }

    jumpToArticleScene = (article: Article) => {
        location.href = new SPAPathBuilder("article", [article.slug]).fullPath()
    }

    toggleFavorite = ( article: Article ): Promise<Article[]> => {
        if ( article === null ) { throw Error("Article is empty.")  }
        let user = this.storage.user()
        if ( user === null ) {
            return new Promise<Article[]>( async (resolve, _) => { resolve(null) } )
        }
        let process = ( article ) => {
            let filtered = this.container.articles.filter( a => a.slug === article.slug )[0]
            let index = this.container.articles.indexOf( filtered )
            this.container.articles.splice(index, 1, article)
            return this.container.articles
        }
        switch (article.favorited) {
        case true:  return this.conduit.unfavorite( user.token, article.slug ).then( process )
        case false: return this.conduit.favorite( user.token, article.slug ).then( process )
        }
    }
}


class ArticlesState {
    scene: string // articles
    kind: string // global, your or tag
    page: number // since by 1
    tag?: string // tagword or null

    constructor( location: SPALocation ) {

        // scene
        this.scene = location.scene() ? location.scene() : "articles"

        // kind
        let paths = location.paths() ? location.paths() : []
        let kind = ( paths.length >= 1 ) ? paths[0] : "global"
        this.kind = kind

        // tag
        if ( kind === "tag" && paths.length >= 2 ) {
            this.tag = paths[1]
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
