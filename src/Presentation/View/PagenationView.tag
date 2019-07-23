<pagenation_view>
<script>
    var self = this
    var countOfPage = 0

    // public property
    self.shownPage = 1
    // public hundler
    self.didSelectPageNumber = () => {}

    // public functions
    self.setCountOfPage = ( count ) => {
        countOfPage = count === null ? 0 : count
        self.update()
    }
    self.isShow = () => {
        return countOfPage > 0
    }

    self.pagesCount = () => {
        return countOfPage
    }

    self.classOfPage = () => {
        return "page-item" // or "page-item active"
    }

    self.arrayOfPageNumber = () => {
        return [...Array(countOfPage).keys()].map(i => ++i)
    }

    self.actionOfClickPageLink = (event) =>{
        self.didSelectPageNumber( event.item.page )
    }

</script>

<ul class="pagination" if={ isShow }>
    <li each={ page in arrayOfPageNumber() } class={ classOfPage() }>
        <a class="page-link" onclick={ actionOfClickPageLink }>{ page }</a>
    </li>
</ul>

</pagenation_view>