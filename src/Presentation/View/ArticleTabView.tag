<article_tab_view>
    
<script>

    import ArticleTabItem from "../Model/ArticleTabItem"
    var self = this

    self.user = null
    self.setUser = ( user ) => {
        self.user = user
        self.update()
    }

    self.items = () => {
        if ( self.user == null ){
            return [
                new ArticleTabItem( "Global Feed", "#/articles")
            ]
        }else{
            return [
                new ArticleTabItem( "Your Feed", "#/articles"),
                new ArticleTabItem( "Global Feed", "#/articles")
            ]
        }
    }

</script>

<div class="feed-toggle">
    <ul class="nav nav-pills outline-active">
        <li class="nav-item" each={ item in items() }>
            <a class="nav-link" href="{ item.href }">{ item.title }</a>
        </li>
    </ul>
</div>

</article_tab_view>