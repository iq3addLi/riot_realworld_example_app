import Article from "../Model/Article"
import Author from "../Model/Author"

import ConduitProductionRepository from "../Repository/ConduitProductionRepository"
import UserLocalStorageRepository from "../Repository/UserLocalStorageRepository"

export default class ArticlesUseCase {

    conduit = new ConduitProductionRepository()
    storage = new UserLocalStorageRepository()

    requestArticles = () => {
        return this.conduit.getArticles()
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
}
