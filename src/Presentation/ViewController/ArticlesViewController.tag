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

    // setup header
    self.tags.header_view.setItems( useCase.menuItems() )

    // request articles
    useCase.requestArticles().then( (container) => {
        self.tags.articles_table_view.setArticles( container.articles )

        // setup pagenation
        self.tags.pagenation_view.shownPage = useCase.currentPage()
        self.tags.pagenation_view.setCountOfPage( useCase.pageCount() )
    })
    // request tagList
    useCase.requestTags().then( (tags) => {
        self.tags.tags_view.setTagWords( tags ) // note: riot.tags are undefined from the promise function
        self.tags.tags_view.update()
    })

    // setup article tab
    self.tags.article_tab_view.setItems( useCase.tabItems() )

    // setup view action handler
    self.tags.pagenation_view.didSelectPageNumber = (page) => {
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


<div class="home-page">
    <!-- Header -->
    <header_view />

    <!-- Banner -->
    <virtual if={ isLoggedIn() == false }>
        <banner_view />
    </virtual>

    <!-- Body -->
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

    <!-- Footer -->
    <footer_view />
</div>

</articles_view_controller>