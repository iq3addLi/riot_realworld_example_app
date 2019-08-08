import ArticlesUseCase from "../../Domain/UseCase/ArticlesUseCase"
import { RiotCoreComponent } from "riot"
import ArticleTabItem from "../../Domain/Model/ArticleTabItem"
import Profile from "../../Domain/Model/Profile"
import Article from "../../Domain/Model/Article"

export default class ArticlesViewController {

    /* IBOutlet */ view: RiotCoreComponent
    /* IBOutlet */ headerView: RiotCoreComponent
    /* IBOutlet */ articleTabView: RiotCoreComponent
    /* IBOutlet */ articlesTableView: RiotCoreComponent

    private useCase = new ArticlesUseCase()

    // Lifecycle

    viewWillAppear = () => {
    }

    viewDidAppear = () => {
        this.headerView.setItems( this.useCase.menuItems() )
        this.articleTabView.setItems( this.useCase.tabItems() )

        this.useCase.requestArticles().then( (container) => {
            this.articlesTableView.setArticles( container.articles )

            // setup pagenation
            // this.pagenation_view.shownPage = useCase.currentPage()
            // this.pagenation_view.setCountOfPage( useCase.pageCount() )
        })
    }

    viewWillDisappear = () => {
        console.log("viewWillAppear")
    }

    viewDidDisappear = () => {
        console.log("viewDidAppear")
    }

    // Public functions

    isLoggedIn = () => {
        return this.useCase.isLoggedIn()
    }

    // IB Actions
    didSelectTab = ( item: ArticleTabItem ) => {
        console.log(item)
    }

    didSelectProfile = ( profile: Profile ) => {
        this.useCase.jumpToProfileScene (profile)
    }

    didSelectArticle = ( article: Article ) => {
        this.useCase.jumpToArticleScene(article)
    }

    didFavoriteArticle = ( article: Article ) => {
        this.useCase.toggleFavorite(article).then( (articles) => {
            if ( articles === null ) { return }
            this.articlesTableView.setArticles( articles )
        })
    }
}
