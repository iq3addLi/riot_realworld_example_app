import { RiotCoreComponent } from "riot"
import ProfileUseCase from "../../Domain/UseCase/ProfileUseCase"
import ArticleTabItem from "../../Domain/Model/ArticleTabItem"
import Profile from "../../Domain/Model/Profile"
import Article from "../../Domain/Model/Article"

export default class ProfileViewController {

    // Outlets
    view: RiotCoreComponent|any
    headerView: RiotCoreComponent|any
    profileView: RiotCoreComponent|any
    articleTabView: RiotCoreComponent|any
    articlesTableView: RiotCoreComponent|any
    pagenationView: RiotCoreComponent|any

    // Usecase
    private useCase = new ProfileUseCase()

    // Lifecycle
    viewWillAppear = () => {
        // console.log("viewWillAppear")  // No action
    }
    viewDidAppear = () => {
        this.headerView.setItems( this.useCase.menuItems() )

        this.useCase.requestProfile().then( (profile) => {
            this.profileView.setProfile( profile, this.useCase.isLoggedIn(), this.useCase.isOwnedProfile() )
        })

        this.useCase.requestArticles().then( (container) => {
            // setup table of article
            this.articlesTableView.setArticles( container.articles )
            // setup pagenation
            this.pagenationView.setCountOfPage( this.useCase.pageCount(), this.useCase.currentPage() )
        })

        // setup article tab
        this.articleTabView.setItems( this.useCase.tabItems() )
    }

    // Actions
    didClickButtonHandler = ( isOwned: boolean ) => {
        if (isOwned) {
            this.useCase.jumpToSettingScene()
        } else {
            this.useCase.toggleFollowing().then( (profile) => {
                this.profileView.setProfile( profile, this.useCase.isLoggedIn(), this.useCase.isOwnedProfile() )
            })
        }
    }
    didSelectTab = ( item: ArticleTabItem ) => {
        this.useCase.jumpToSubPath( item.identifier )
    }
    didSelectProfile = ( profile: Profile ) => {
        this.useCase.jumpToProfileScene (profile)
    }
    didSelectArticle = ( article: Article ) => {
        this.useCase.jumpToArticleScene(article)
    }
    didFavoriteArticle = ( article: Article ) => {
        // only logged-in
        if ( this.useCase.isLoggedIn() === false ) { return }
        this.useCase.toggleFavorite(article).then( (articles) => {
            if ( articles === null ) { return }
            this.articlesTableView.setArticles( articles )
        })
    }
    didSelectPageNumber = ( page: number ) => {
        this.useCase.jumpPage(page)
    }
}
