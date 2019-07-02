<tags_view>
<script>
    var self = this

    self.tagWords = [] // tags is reserved word in riot.js
    self.setTagWords = ( tagWords  ) => {
        self.tagWords = tagWords
        self.update()
    }

</script>

<div class="sidebar">
    <p>Popular Tags</p>
    <div class="tag-list">
        <a each={ tag in tagWords } href="#/articles?tag={ tag }" class="tag-pill tag-default">{ tag }</a>
    </div>
</div>

</tags_view>