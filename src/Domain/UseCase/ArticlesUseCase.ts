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

    private currentArticle?: ArticleContainer = null
    private state: ArticlesState

    constructor() {
        this.state = new ArticlesState( SPALocation.shared() )
    }

    requestArticles = () => {
        let limit: number = Settings.shared().valueForKey("countOfArticleInView")
        let offset = this.state.page == null ? null : (this.state.page - 1) * limit
        let pastProcess = (c) => { this.currentArticle = c; return c }

        switch (this.state.kind) {
        case "your":
            let user = this.storage.user()
            if ( user != null ) {
                return this.conduit.getArticlesByFollowingUser( user.token, limit, offset).then( pastProcess )
            } else {
                console.log("Unexpected page call.")
            }
            break
        case "tag":
            return this.conduit.getArticlesOfTagged( this.state.tag, limit, offset).then( pastProcess )
        case "global":
        default:
            return this.conduit.getArticles(limit, offset).then( pastProcess )
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
        if (this.currentArticle == null || this.currentArticle.count === 0) {
            return 0
        }
        let limit: number = Settings.shared().valueForKey("countOfArticleInView")
        return Math.floor(this.currentArticle.count / limit)
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
        // page transition
        location.href = path
    }


    jumpPageBySubPath = (path: string) => {
        let full = new SPAPathBuilder( this.state.scene, [path]).fullPath()
        // page transition
        location.href = full
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
