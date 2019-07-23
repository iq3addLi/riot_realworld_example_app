import UserLocalStorageRepository from "../Repository/UserLocalStorageRepository"
import ConduitProductionRepository from "../Repository/ConduitProductionRepository"
import PostArticle from "../Model/PostArticle"
import Article from "../Model/Article"
import SPAPathBuilder from "../../Infrastructure/SPAPathBuilder"

export default class EditerUseCase {

    conduit = new ConduitProductionRepository()
    storage = new UserLocalStorageRepository()
    isLoggedIn = () => {
        return this.storage.isLoggedIn()
    }
    loggedUser = () => {
        return this.storage.user()
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
