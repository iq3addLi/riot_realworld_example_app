<pagenation_view>
<script>
    var self = this
    var countOfPage = 0

    self.setCountOfPage = ( count ) => {
        countOfPage = count
        self.update()
    }

    self.shownPage = 1

    self.isShow = () => {
        return countOfPage > 0
    }

    self.pagesCount = () => {
        return countOfPage
    }

    self.classOfPage = () => {
        return "page-item" // or "page-item active"
    }

    self.hrefOfPage = () => {
        return "#/articles" // "#/articles?page={page}"
    }

    self.arrayOfPageNumber = () => {
        return [...Array(countOfPage).keys()].map(i => ++i)
    }
</script>

<ul class="pagination" if={ isShow }>
    <li each={ page in arrayOfPageNumber() } class={ classOfPage() }>
        <a class="page-link" href={ hrefOfPage() }>{ page }</a>
    </li>
</ul>

</pagenation_view>