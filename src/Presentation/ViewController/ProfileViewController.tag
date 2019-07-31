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

    // setup header
    self.tags.header_view.setItems( useCase.menuItems() )

    // request profile
    useCase.requestProfile().then( (profile) => {
        // setup profile view
        self.tags.profile_view.setProfile( profile, useCase.isLoggedIn(), useCase.isOwnedProfile() )
    })

    // request articles
    useCase.requestArticles().then( (container) => {
        // setup table of article 
        self.tags.articles_table_view.setArticles( container.articles )
        // setup pagenation
        self.tags.pagenation_view.shownPage = useCase.currentPage()
        self.tags.pagenation_view.setCountOfPage( useCase.pageCount() )
    })

    // setup article tab
    self.tags.article_tab_view.setItems( useCase.tabItems() )

    // setup view action handler
    self.tags.article_tab_view.didSelectTab = (item) => {
        useCase.jumpPageBySubPath(item.identifier)
    }
    self.tags.profile_view.didClickButtonHandler = (isOwned) => {
        if (isOwned){
            useCase.jumpToSettingScene()
        }else{
            useCase.toggleFollowing().then( (profile) =>{
                self.tags.profile_view.setProfile( profile, useCase.isLoggedIn(), useCase.isOwnedProfile() )
            })
        }
    }
    self.tags.pagenation_view.didSelectPageNumber = (page) => {
        useCase.jumpPage(page)
    }
    self.tags.articles_table_view.didSelectArticle = (article) => {
        useCase.jumpPageByArticle(article)
    }
    self.tags.articles_table_view.didSelectProfile  = (profile) => {
        useCase.jumpPageByProfile(profile)
    }
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