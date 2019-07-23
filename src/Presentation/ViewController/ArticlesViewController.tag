import "../View/HeaderView.tag"
import "../View/FooterView.tag"
import "../View/BannerView.tag"
import "../View/ArticleTabView.tag"
import "../View/ArticlesTableView.tag"
import "../View/TagsView.tag"
import "../View/PagenationView.tag"

<articles_view_controller>

<script>
import ArticlesUseCase from "../../Domain/UseCase/ArticlesUseCase"

var self = this
var useCase = new ArticlesUseCase()

this.on('mount', () => {

    useCase.requestArticles().then( (container) => {
        self.tags.articles_table_view.setArticles( container.articles )

        self.tags.pagenation_view.shownPage = useCase.currentPage()
        self.tags.pagenation_view.setCountOfPage( useCase.pageCount() )
    })
    useCase.requestTags().then( (tags) => {
        self.tags.tags_view.setTagWords( tags ) // riot.tags are undefined from the promise function
        self.tags.tags_view.update()
    })

    if ( useCase.isLoggedIn() == true ) {
        let user = useCase.loggedUser()
        self.tags.header_view.setUser( user )
    }

    self.tags.article_tab_view.setItems( useCase.tabItems() )

    // set handler
    self.tags.pagenation_view.didSelectPageNumber = (page) => {
        console.log("page " + page + " selected.")
        useCase.jumpPage(page)
    }
    self.tags.article_tab_view.didSelectTab = (item) => {
        useCase.jumpPageBySubPath(item.identifier)
    }
    self.tags.articles_table_view.didSelectArticle = (article) => {
        useCase.jumpPageByArticle(article)
    }
    self.tags.articles_table_view.didSelectProfile  = (profile) => {
        useCase.jumpPageByProfile (profile)
    }
})

self.isLoggedIn = () => {
    return useCase.isLoggedIn()
}

</script>
                
<header_view />
<virtual if={ isLoggedIn() == false }>
    <banner_view />
</virtual>

<div class="container page">
    <div class="row">
        <div class="col-md-9">
            <article_tab_view toggle_style="feed-toggle"/>
            <articles_table_view />
            <pagenation_view />
        </div>
        <div class="col-md-3">
            <tags_view/>
        </div>
    </div>
</div>

<footer_view />

</articles_view_controller>