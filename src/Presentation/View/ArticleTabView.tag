<article_tab_view>
    
<script>

    import ArticleTabItem from "../Model/ArticleTabItem"
    var self = this
    var _items = null
    
    // public handler
    self.didSelectTab = () => {}

    // public fuction
    self.setItems = ( items ) => {
        _items = items
        self.update()
    }

    self.items = () => {
        return _items
    }

    self.actionOfClickTab = (event) => {
        self.didSelectTab( event.item.item )
    }
</script>

<div class={ opts.toggle_style }>
    <ul class="nav nav-pills outline-active">
        <li class="nav-item" each={ item in items() }>
            <a class={ item.isActive ? "nav-link active" : "nav-link" } onclick={ actionOfClickTab }>{ item.title }</a>
        </li>
    </ul>
</div>

</article_tab_view>