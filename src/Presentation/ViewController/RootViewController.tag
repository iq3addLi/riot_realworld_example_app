import "../View/HeaderView.tag"
import "../View/FooterView.tag"
import "../View/BannerView.tag"
import "../View/ArticleTabView.tag"
import "../View/ArticlesTableView.tag"
import "../View/TagsView.tag"

<root_view_controller>

<script>
import RootUseCase from "../../Domain/UseCase/RootUseCase"
import ArticleTabItem from "../Model/ArticleTabItem"

var self = this
var useCase = new RootUseCase()

this.on('mount', () => {
    useCase.requestArticles( ( articles, error ) => {
        if (error != null){
            //riot.mount( "rootviewcontroller", "errorviewcontroller", { "error": error })
            //return
        }
        self.tags.articles_table_view.articles = articles
        self.tags.articles_table_view.update()
    })

    useCase.requestTags().then( (tags) => {
        self.refs.tagsView.tagWords = tags // riot.tags are undefined from the promise function 
        self.refs.tagsView.update()
    })

    if ( useCase.isLoggedIn() == true ) {
        self.tags.article_tab_view.items = [
            new ArticleTabItem( "Your Feed", "#/articles"),
            new ArticleTabItem( "Global Feed", "#/articles")
        ]
        self.tags.article_tab_view.update()
    }
    else{
        self.tags.article_tab_view.items = [
            new ArticleTabItem( "Global Feed", "#/articles")
        ]
        self.tags.article_tab_view.update()
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
            <article_tab_view />
            <articles_table_view />
        </div>
        <div class="col-md-3">
            <tags_view ref="tagsView"/>
        </div>
    </div>
</div>

<footer_view />

</root_view_controller>