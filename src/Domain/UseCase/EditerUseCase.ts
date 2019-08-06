import UserLocalStorageRepository from "../Repository/UserLocalStorageRepository"
import ConduitProductionRepository from "../Repository/ConduitProductionRepository"
import PostArticle from "../Model/PostArticle"
import Article from "../Model/Article"
import SPAPathBuilder from "../../Infrastructure/SPAPathBuilder"
import MenuItemsBuilder from "../Utility/MenuItemsBuilder"
import SPALocation from "../../Infrastructure/SPALocation"

export default class EditerUseCase {

    private conduit = new ConduitProductionRepository()
    private storage = new UserLocalStorageRepository()

    private state: EditerState

    constructor() {
        this.state = new EditerState( SPALocation.shared() )
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

    ifNeededRequestArticle = () => {
        if ( this.state.slug === null ) {
            // needless
            return new Promise<Article>( async (resolve, _) => { resolve(null) } )
        }
        return this.conduit.getArticle( this.state.slug )
    }

    isNewArticle = () => {
        return this.state.slug === null
    }

    post = ( title: string, description: string, body: string, tagList: string) => {
        let splitted = tagList.split(",")
        let tags: string[] = (splitted.length > 0 ? splitted : null )
        if ( this.state.slug === null ) {
            // new article
            return this.conduit.postArticle(this.storage.user().token, new PostArticle(title, description, body, tags))
        } else {
            // update
            return this.conduit.updateArticle(this.storage.user().token, new PostArticle(title, description, body, tags), this.state.slug)
        }
    }

    jumpToArticleScene = (article: Article) => {
        location.href = new SPAPathBuilder("article", [article.slug]).fullPath()
    }

    jumpToNotFound = () => {
        location.href = "#/notfound"
    }
}

class EditerState {
    scene: string
    slug?: string // slug or null

    constructor( location: SPALocation ) {
        // scene
        this.scene = location.scene()

        // slug
        let paths = location.paths() ? location.paths() : []
        this.slug = ( paths.length >= 1 ) ? paths[0] : null
    }
}
