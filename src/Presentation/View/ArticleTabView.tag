<article_tab_view>
    
<script>

    import ArticleTabItem from "../Model/ArticleTabItem"
    var self = this
    var _items = null
    
    self.setItems = ( items ) => {
        _items = items
        self.update()
    }

    self.items = () => {
        return _items
    }

</script>

<div class="feed-toggle">
    <ul class="nav nav-pills outline-active">
        <li class="nav-item" each={ item in items() }>
            <a class={ item.isActive ? "nav-link active" : "nav-link" } href="{ item.href }">{ item.title }</a>
        </li>
    </ul>
</div>

</article_tab_view>