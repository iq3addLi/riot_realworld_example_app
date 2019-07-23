import Article from "../Model/Article"
import Profile  from "../Model/Profile "

import ConduitProductionRepository from "../Repository/ConduitProductionRepository"
import UserLocalStorageRepository from "../Repository/UserLocalStorageRepository"
import SPALocation from "../../Infrastructure/SPALocation"
import Settings from "../../Infrastructure/Settings"
import SPAPathBuilder from "../../Infrastructure/SPAPathBuilder"
import ArticleContainer from "../Model/ArticleContainer"
import ArticleTabItem from "../../Presentation/Model/ArticleTabItem"

export default class ArticlesUseCase {

    conduit = new ConduitProductionRepository()
    storage = new UserLocalStorageRepository()

    private currentArticle?: ArticleContainer = null

    requestArticles = () => {
        let limit: number = Settings.shared().valueForKey("countOfArticleInView")
        let page = this.currentPage()
        let offset = page == null ? null : (page - 1) * limit
        let postProcess = (container: ArticleContainer) => {
            this.currentArticle = container
            return container
        }
        let paths = SPALocation.shared().paths()
        let first = paths != null ? paths[0] : "global"
        switch (first) {
        case "your":
            let user = this.storage.user()
            if ( user != null ) {
                return this.conduit.getArticlesByFollowingUser( user.token, limit, offset).then( postProcess )
            } else {
                // 不正な呼び出し /loginへ転送する
            }
            break
        case "tag":
            return this.conduit.getArticlesOfTagged(paths[1], limit, offset).then( postProcess ); break
        case "global":
        default:
            return this.conduit.getArticles(limit, offset).then( postProcess )
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
        return this.currentArticle.count / limit
    }

    currentPage = () => {
        let loc = SPALocation.shared()
        let query = loc.query()
        if ( query == null || query["page"] == null ) { return null }
        return Number(query["page"])
    }

    tabItems = () => {
        let tabs: ArticleTabItem[] = []
        let paths = SPALocation.shared().paths()
        // Add "Your feed" ?
        if ( this.storage.user() != null ) {
            let isActiveYour = ( paths != null && paths[0] === "your" )
            tabs.push( new ArticleTabItem( "your", "Your Feed", isActiveYour) )
        }
        // Add "Global feed"
        let isActiveGlobal = ( paths == null || paths[0] === "global" )
        tabs.push( new ArticleTabItem( "global", "Global Feed", isActiveGlobal) )
        // Add "# {tag}" ?
        if ( paths != null && paths[0] === "tag" ) {
            let tag = paths[1]
            if (tag != null) {
                tabs.push( new ArticleTabItem( "tag", "# " + tag, true) )
            }
        }
        return tabs
    }

    jumpPage = (page: number) => {
        let loc = SPALocation.shared()
        let query = loc.query() ? loc.query() : {}
        query["page"] = String(page)
        let top = loc.scene() ? loc.scene() : "articles"
        let path = new SPAPathBuilder(top, loc.paths(), query ).fullPath()
        // page transition
        location.href = path
    }


    jumpPageBySubPath = (path: string) => {
        let loc = SPALocation.shared()
        let top = loc.scene() ? loc.scene() : "articles"
        let full = new SPAPathBuilder(top, [path]).fullPath()
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
