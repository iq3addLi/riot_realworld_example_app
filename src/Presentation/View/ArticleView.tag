<article_view>

<script>
import marked from "marked"

let self = this
self.article = null

self.setArticle = ( article ) => {
    self.article = article
    self.update()
}

self.markedBody = ( body ) => {
    return marked( self.article.body )
}

</script>

<!-- markdown by marked -->
<virtual if={ article !== null }>
    <article_body_field marked_body={ markedBody(article.body) } />
    <ul class="tag-list">
        <virtual each={ tagWord in article.tagList }>
            <li class="tag-default tag-pill tag-outline">{ tagWord }</li>
        </virtual>
    </ul>
</virtual>
</article_view>

<article_body_field>
<script>
this.root.innerHTML = opts.marked_body
this.on("update", () => {
    this.root.innerHTML = opts.marked_body
})
</script>
</article_body_field>
