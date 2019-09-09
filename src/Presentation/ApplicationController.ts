// Usecase
import ApplicationUseCase from "../Domain/UseCase/ApplicationUseCase"

// Riot components
import ArticlesComponent from "./ViewController/Articles.riot"
import ArticleComponent from "./ViewController/Article.riot"
import LoginComponent from "./ViewController/Login.riot"
import RegisterComponent from "./ViewController/Register.riot"
import EditerComponent from "./ViewController/Editer.riot"
import ProfileComponent from "./ViewController/Profile.riot"
import SettingsComponent from "./ViewController/Settings.riot"
import ShowErrorComponent from "./ViewController/ShowError.riot"

// Model
import Scene from "../Domain/Model/Scene"

export default class ApplicationController {

    // Usecase
    private useCase = new ApplicationUseCase()

    willFinishLaunching = () => {

        // Setup usecase
        const notFoundScene: Scene = { name: "show_error", component: ShowErrorComponent, filter: null, props: { message: "Your order is not found." }} // Not found
        this.useCase.setMainViewSelector("div#mainView")
        this.useCase.setScenes([
            { name: "login", component: LoginComponent, filter: "/login" },
            { name: "settings", component: SettingsComponent, filter: "/settings" },
            { name: "articles", component: ArticlesComponent, filter: "/articles.." },
            { name: "article", component: ArticleComponent, filter: "/article.." },
            { name: "editer", component: EditerComponent, filter: "/editer.." },
            { name: "profile", component: ProfileComponent, filter: "/profile.." },
            { name: "register", component: RegisterComponent, filter: "/register" },
            notFoundScene
        ])
        this.useCase.setHome( "articles", ArticlesComponent )
        this.useCase.setNotFoundScene( notFoundScene )
    }

    didFinishLaunching = () => {

        const useCase = this.useCase
        useCase.initialize( ( error: Error ) => {
            if (error != null) {
                throw Error("Application initialize is failed: " + error.message )
            }
            useCase.routing()
            useCase.showMainView()
        })
    }
}
