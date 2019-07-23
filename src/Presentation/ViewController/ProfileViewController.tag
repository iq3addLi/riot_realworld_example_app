import "../View/HeaderView.tag"
import "../View/FooterView.tag"
import "../View/BannerView.tag"
import "../View/ProfileView.tag"
import "../View/ArticleTabView.tag"
import "../View/ArticlesTableView.tag"
import "../View/PagenationView.tag"

<profile_view_controller>

<script>
import ProfileUseCase from "../../Domain/UseCase/ProfileUseCase"

var self = this
var useCase = new ProfileUseCase()

this.on('mount', () => {
    if ( useCase.isLoggedIn() == true ) {
        self.tags.header_view.setUser( useCase.loggedUser() )
    }
    // request profile
    useCase.requestProfile( (profile) => {
        self.tags.profile_view.setProfile( profile, useCase.isLoggedIn(), useCase.isOwnedProfile() )

        // request articles
        useCase.requestArticles( (articles) => {
            self.tags.articles_table_view.setArticles( articles )
            self.tags.pagenation_view.shownPage = useCase.currentPage()
            self.tags.pagenation_view.setCountOfPage( useCase.pageCount() )
        })
    })
    self.tags.article_tab_view.setItems( useCase.tabItems() )
})


</script>

<header_view />

<div class="profile-page">

    <!-- Profile Header -->
    <div class="user-info">
        <div class="container">
            <div class="row">
                <div class="col-xs-12 col-md-10 offset-md-1">
                    <profile_view />
                </div>
            </div>
        </div>
    </div>
    
    <!-- Profile Articles -->
    <div class="container">
        <div class="row">
            <div class="col-xs-12 col-md-10 offset-md-1">
                <article_tab_view toggle_style="articles-toggle"/>
                <articles_table_view />
                <pagenation_view />
            </div>
        </div>
    </div>

</div>

<footer_view />

</profile_view_controller>