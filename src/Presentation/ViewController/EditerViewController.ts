import { RiotCoreComponent } from "riot"
import EditerUseCase from "../../Domain/UseCase/EditerUseCase"

export default class EditerViewController {

    // Outlets
    view: RiotCoreComponent|any
    headerView: RiotCoreComponent|any

    // Usecase
    private useCase = new EditerUseCase()

    // Lifecycle

    viewWillAppear = () => {
        if ( this.useCase.isLoggedIn() === false ) {
            this.useCase.jumpToNotFound()
        }
    }
    viewDidAppear = () => {
        this.headerView.setItems( this.useCase.menuItems() )

        // request article
        this.useCase.ifNeededRequestArticle().then( (article) => {
            if (article == null ) { return }
            // setup form
            this.view.setArticle( article.title, article.description, article.body, article.tagList.join(",") )
        })
    }

    postArticle = ( title: string, description: string , body: string, tagsString: string ) => {
        this.useCase.post(title, description, body, tagsString).then( (article) => {
            // success
            this.useCase.jumpToArticleScene(article)
        }).catch( (error) => {
            // failure
            if (error instanceof Array ) {
                this.view.setErrorMessages( error.map( (aError) => aError.message ) )
            } else if ( error instanceof Error ) {
                this.view.setErrorMessages( [ error.message ] )
            }
        })
    }

    submitButtonTitle = () => {
        return this.useCase.isNewArticle() ? "Publish Article" : "Update Article"
    }
}
