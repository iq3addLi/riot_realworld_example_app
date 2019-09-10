import { RiotCoreComponent } from "riot"
import ArticleUseCase from "../../Domain/UseCase/ArticleUseCase"
import Article from "../../Domain/Model/Article"

export default class ArticleViewController {

    // Outlets
    view: RiotCoreComponent|any
    headerView: RiotCoreComponent|any
    aboveWidgetView: RiotCoreComponent|any
    belowWidgetView: RiotCoreComponent|any
    articleView: RiotCoreComponent|any
    commentFormView: RiotCoreComponent|any
    commentTableView: RiotCoreComponent|any

    // Usecase
    private useCase = new ArticleUseCase()

    // Lifecycle
    viewWillAppear = () => {
        // console.log("viewWillAppear")  // No action
    }
    viewDidAppear = () => {
        // setup header
        this.headerView.setItems( this.useCase.menuItems() )

        // setup profile
        if ( this.useCase.isLoggedIn() ) {
            let profile = this.useCase.loggedUserProfile()
            this.aboveWidgetView.setLoggedUserProfile( profile )
            this.belowWidgetView.setLoggedUserProfile( profile )
            this.commentTableView.setLoggedUserProfile( profile )
            this.commentFormView.setProfile( profile )
        }

        // setup article
        this.useCase.requestArticle().then( (article) => {
            this.articleView.setArticle( article )
            this.setArticleForWidgets( article )

            this.view.update()
        })

        // setup comments
        this.useCase.requestComments().then( (comments) => {
            this.commentTableView.setComments( comments )
        })
    }

    // Public
    currentArticleTitle = () => {
        let article = this.useCase.currentArticle()
        return article !== null ? article.title : ""
    }

    // Actions
    didFollowHandler = () => {
        this.useCase.toggleFollowing().then( () => {
            this.setArticleForWidgets( this.useCase.currentArticle() )
        })
    }
    didArticleFavoriteHandler = () => {
        this.useCase.toggleFavorite().then( () => {
            this.setArticleForWidgets( this.useCase.currentArticle() )
        })
    }
    didArticleEditingHandler = () => {
        this.useCase.jumpToEditerScene()
    }
    didArticleDeleteHandler = () => {
        this.useCase.deleteArticle().then( () => {
            this.useCase.jumpToHome()
        })
    }

    didCommentSubmitHandler = ( comment: string ) => {
        this.useCase.postComment( comment ).then( () => {
            this.commentTableView.setComments( this.useCase.currentComments() )
            this.commentFormView.clearComment()
        })
    }
    didCommentDeleteHandler = ( commentId: number ) => {
        this.useCase.deleteComment( commentId ).then( () => {
            this.commentTableView.setComments( this.useCase.currentComments() )
        })
    }

    // Private
    private setArticleForWidgets = ( article: Article ) => {
        this.aboveWidgetView.setArticle( article )
        this.belowWidgetView.setArticle( article )
    }
}
