<articles_table_view>

<script>

    var self = this

    self.articles = []
    self.setArticles = ( articles ) => {
        self.articles = articles
        self.update()
    }

</script>

<div class="article-preview" each={ article in articles }>
    <div class="article-meta">
        <a href="profile.html"><img src={ article.author.image } /></a>
        <div class="info">
            <a href="" class="author">{ article.author.username }</a>
            <span class="date">January 20th</span>
        </div>
        <button class="btn btn-outline-primary btn-sm pull-xs-right">
        <i class="ion-heart"></i> { article.favoritesCount }
        </button>
    </div>
    <a href="" class="preview-link">
        <h1>{ article.title } </h1>
        <p>{ article.description }</p>
        <span>Read more...</span>
    </a>
</div>

</articles_table_view>