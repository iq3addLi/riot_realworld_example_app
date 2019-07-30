import "../View/HeaderView.tag"
import "../View/FooterView.tag"
import "../View/ArticleWidgetView.tag"
import "../View/ArticleView.tag"
import "../View/CommentFormView.tag"
import "../View/CommentTableView.tag"

<article_view_controller>

<script>
import ArticleUseCase from "../../Domain/UseCase/ArticleUseCase"

var self = this
var useCase = new ArticleUseCase()

this.on('mount', () => {

    // setup header
    self.tags.header_view.setItems( useCase.menuItems() )

    // set profile
    let profile = useCase.loggedUserProfile()
    self.refs.above_widget_view.loggedUserProfile = profile
    self.refs.below_widget_view.loggedUserProfile = profile
    self.tags.comment_table_view.loggedUserProfile = profile
    self.tags.comment_form_view.setProfile( profile )

    // set article
    useCase.requestArticle().then( (article) => {
        self.tags.article_view.setArticle( article )
        setArticleForWidgets( article )
        self.update()
    })

    // set comments
    useCase.requestComments().then( (comments) => {
        self.tags.comment_table_view.setComments( comments )
    })

    // setup view action handler
    let didFollowHandler = () => {
        useCase.toggleFollowing().then( () =>{
            setArticleForWidgets( useCase.currentArticle() )
        })
    }
    let didFavoriteHandler = () => {
        useCase.toggleFavorite().then( () =>{
            setArticleForWidgets( useCase.currentArticle() )
        })
    }
    let didEditingHandler = () => {
        useCase.jumpToEditerScene()
    }
    let didDeleteHandler = () => {
        useCase.deleteArticle().then( () => {
            useCase.jumpToHome()
        }) 
    }
    self.refs.above_widget_view.didFollowHandler = didFollowHandler
    self.refs.below_widget_view.didFollowHandler = didFollowHandler
    self.refs.above_widget_view.didFavoriteHandler = didFavoriteHandler
    self.refs.below_widget_view.didFavoriteHandler = didFavoriteHandler
    self.refs.above_widget_view.didEditingHandler = didEditingHandler
    self.refs.below_widget_view.didEditingHandler = didEditingHandler
    self.refs.above_widget_view.didDeleteHandler = didDeleteHandler
    self.refs.below_widget_view.didDeleteHandler = didDeleteHandler

    self.tags.comment_form_view.didSubmitHandler = ( comment ) => {
        useCase.postComment( comment ).then( () => {
            self.tags.comment_table_view.setComments( useCase.currentComments() )
            self.tags.comment_form_view.clearComment()
        })
    }
    self.tags.comment_table_view.didDeleteHandler = ( commentId ) => {
        useCase.deleteComment( commentId ).then( () => {
            self.tags.comment_table_view.setComments( useCase.currentComments() )
        })
    }
})

self.currentArticleTitle = () => {
    let article = useCase.currentArticle()
    return article !== null ? article.title : ""
}

// private
var setArticleForWidgets = (article) => {
    self.refs.above_widget_view.setArticle( article )
    self.refs.below_widget_view.setArticle( article )
}

</script>

<header_view />

<div class="article-page">

    <!-- Banner with profile -->
    <div class="banner">
        <div class="container">
            <h1>{ currentArticleTitle() }</h1>
            <article_widget_view ref="above_widget_view"/>
        </div>
    </div>

    <!-- Article -->
    <div class="container page">
        <div class="row article-content">
            <div class="col-md-12">
                <article_view />
            </div>
        </div>
    </div>

    <hr />

    <!-- Article below profile -->
    <div class="article-actions">
        <article_widget_view ref="below_widget_view"/>
    </div>

    <!-- Comment -->
    <div class="row">
        <div class="col-xs-12 col-md-8 offset-md-2">
            <!-- Comment form -->
            <comment_form_view />

            <!-- Comment threads -->
            <comment_table_view />
        </div>
    </div>
    
</div>

<footer_view />

</article_view_controller>