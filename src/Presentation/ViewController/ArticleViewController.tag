import "../View/HeaderView.tag"
import "../View/FooterView.tag"
import "../View/ProfileWidgetView.tag"
import "../View/ArticleView.tag"
import "../View/CommentFormView.tag"
import "../View/CommentTableView.tag"

<article_view_controller>

<script>
import ArticleUseCase from "../../Domain/UseCase/ArticleUseCase"

var self = this
var useCase = new ArticleUseCase()

this.on('mount', () => {
    if ( useCase.isLoggedIn() == true ) {
        self.tags.header_view.setUser( useCase.loggedUser() )
    }
})
</script>

<header_view />

<div class="article-page">

    <!-- Banner with profile -->
    <div class="banner">
        <div class="container">
            <h1>How to build webapps that scale</h1>
            <profile_widget_view ref="above_profile_view"/>
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
        <profile_widget_view ref="below_profile_view"/>
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