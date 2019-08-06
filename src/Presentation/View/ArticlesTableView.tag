<articles_table_view>

<script>

var self = this

self.articles = []
self.setArticles = ( articles ) => {
    self.articles = articles
    self.update()
}

self.didSelectProfile  = () => {}
self.actionOfClickProfile  = (event) => {
    self.didSelectProfile ( event.item.article.author )
}

self.didSelectArticle = () => {}
self.actionOfClickArticle = (event) => {
    self.didSelectArticle( event.item.article )
}

self.didFavorite = () => {}
self.actionOfFavoriteButton = (event) => {
    self.didFavorite( event.item.article )
}

</script>

<style>
.author-link{
    color: #5cb85c;
    cursor : pointer;
    text-decoration: none;
}
.author-link:hover{
    color: #5cb85c;
    text-decoration: underline;
}
</style>

<div class="article-preview" each={ article in articles }>
    <div class="article-meta">
        <a onclick={ actionOfClickProfile  }><img src={ article.author.image } /></a>
        <div class="info">
            <a class="author author-link" onclick={ actionOfClickProfile  }>{ article.author.username }</a>
            <span class="date">January 20th</span>
        </div>
        <button onclick={ actionOfFavoriteButton } class={ btn: true, btn-sm: true, pull-xs-right: true, btn-primary: article.favorited, btn-outline-primary: !article.favorited}>
        <i class="ion-heart"></i> { article.favoritesCount }
        </button>
    </div>
    <a class="preview-link" onclick={ actionOfClickArticle }>
        <h1>{ article.title } </h1>
        <p>{ article.description }</p>
        <span>Read more...</span>
        <ul class="tag-list">
            <li each={ tagWord in article.tagList } class="tag-default tag-pill tag-outline">{ tagWord }</li>
        </ul>
    </a>
</div>

</articles_table_view>
