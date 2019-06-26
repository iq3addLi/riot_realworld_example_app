<tags_view>
<script>
    var self = this
    self.tagWords = []
</script>

<div class="sidebar">
    <p>Popular Tags</p>
    <div class="tag-list">
        <a each={ tag in tagWords } href="#/articles?tag={ tag }" class="tag-pill tag-default">{ tag }</a>
    </div>
</div>

</tags_view>