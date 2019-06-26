<article_tab_view>
    
<script>

var self = this
self.items = []

</script>

<div class="feed-toggle">
    <ul class="nav nav-pills outline-active">
        <li class="nav-item"  each={ item in items }>
            <a class="nav-link" href="{ item.href }">{ item.title }</a>
        </li>
    </ul>
</div>

</article_tab_view>