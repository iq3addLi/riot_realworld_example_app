import UserLocalStorageRepository from "../Repository/UserLocalStorageRepository"
import Profile from "../Model/Profile"
import Article from "../Model/Article"
import ArticleContainer from "../Model/ArticleContainer"
import SPALocation from "../../Infrastructure/SPALocation"
import Settings from "../../Infrastructure/Settings"
import ArticleTabItem from "../../Presentation/Model/ArticleTabItem"
import Profile  from "../Model/Profile "

export default class ProfileUseCase {

    storage = new UserLocalStorageRepository()

    profile?: Profile
    private currentArticle?: ArticleContainer = null

    isLoggedIn = () => {
        return this.storage.isLoggedIn()
    }

    loggedUser = () => {
        return this.storage.user()
    }

    isOwnedProfile = () => {
        return false
    }

    requestProfile = ( completion: (profile?: Profile) => void) => {
        let profile = new Profile("dummy_monkey", "hey you are dunk to my ass!", "http://flat-icon-design.com/f/f_object_157/svg_f_object_157_0bg.svg", false)
        this.profile = profile
        completion(profile)
    }

    requestArticles = ( completion: (articles?: Article[]) => void) => {
        let articles = [
            new Article("Dummy Article", "dumm-ahjsishljfb", "# You are dummy!", "", "", ["dummy", "big"], "Why need description on a article?",
                new Profile ("hoge", "bio", "http://flat-icon-design.com/f/f_object_169/svg_f_object_169_0bg.svg", true) , true, 100)
        ]
        this.currentArticle = new ArticleContainer(1, articles)
        completion(articles)
    }

    pageCount = () => {
        if (this.currentArticle == null || this.currentArticle.count === 0) {
            return 0
        }
        let limit: number = Settings.shared().valueForKey("countOfArticleInView")
        return Math.floor(this.currentArticle.count / limit)
    }

    currentPage = () => {
        let loc = SPALocation.shared()
        let query = loc.query()
        if ( query == null || query["page"] == null ) { return null }
        return Number(query["page"])
    }

    tabItems = () => {
        let tabs: ArticleTabItem[] = [
            new ArticleTabItem( "mine", "My Articles", true) ,
            new ArticleTabItem( "favorite", "Favorite Articles", false)
        ]
        return tabs
    }
}
