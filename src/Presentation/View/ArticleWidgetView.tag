<article_widget_view>

<script>
import moment from "moment"
var self = this
self.article = null
self.loggedUserProfile = null

self.didFollowHandler  = () => {}
self.didFavoriteHandler  = () => {}
self.didEditingHandler = () => {}
self.didDeleteHandler  = () => {}

self.setArticle = ( article ) => {
    self.article = article
    self.update()
}
self.formattedDate = ( date ) => {
    return moment( date ).format("MMMM DD, YYYY")
}

self.isOwnArticle = () =>{
    let profile = self.loggedUserProfile
    let article = self.article
    if ( profile === null || article === null ) return false
    return profile.username === article.author.username
}

</script>

<div class="article-meta" if={ article !== null }>

    <!-- infomation of article author -->
    <a href={ "#/profile/" + article.author.username }><img src={ article.author.image } /></a>
    <div class="info">
        <a href={ "#/profile/" + article.author.username } class="author">{ article.author.username }</a>
        <span class="date">{ formattedDate( article.createdAt ) }</span>
    </div>

    <!-- follow or favorite to other user -->
    <virtual if={ isOwnArticle() == false }>
        <button onclick={ didFollowHandler } class={ btn: true, btn-sm: true, btn-secondary: article.author.following, btn-outline-secondary: !article.author.following }>
            <i class="ion-plus-round"></i>&nbsp;
            { (article.author.following ? "Unfollow" : "Follow") + " " + article.author.username }
        </button>
        &nbsp;&nbsp;
        <button onclick={ didFavoriteHandler } class={ btn: true, btn-sm: true, btn-primary: article.favorited,  btn-outline-primary: !(article.favorited) }>
            <i class="ion-heart"></i>&nbsp;
            { (article.favorited ? "Unfavorite" : "Favorite") + " Article" } 
            <span class="counter">({ article.favoritesCount })</span>
        </button>
    </virtual>

    <!-- update or delete to the article -->
    <virtual if={ isOwnArticle() }>
        <button onclick={ didEditingHandler } class="btn btn-sm btn-outline-secondary">
            <i class="ion-edit"></i>&nbsp;Edit Article
        </button>
        &nbsp;&nbsp;
        <button onclick={ didDeleteHandler } class="btn btn-sm btn-outline-danger">
            <i class="ion-trash-a"></i>&nbsp;Delete Article
        </button>
    </virtual>
</div>

</article_widget_view>
