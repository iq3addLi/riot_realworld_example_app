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

    post = ( title: string, description: string, body: string, tagList: string) => {
        let splitted = tagList.split(",")
        let tags: string[] = (splitted.length > 0 ? splitted : null )
        return this.conduit.postArticle(this.storage.user().token, new PostArticle(title, description, body, tags))
    }

    jumpPageByArticle = (article: Article) => {
        // page transition
        location.href = new SPAPathBuilder("article", [article.slug]).fullPath()
    }
}

class EditerState {
    scene: string // article

    constructor( location: SPALocation ) {
        // scene
        this.scene = location.scene()
    }
}
