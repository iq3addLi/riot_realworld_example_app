import "../View/HeaderView.tag"
import "../View/FooterView.tag"

<editer_view_controller>

<script>
import EditerUseCase from "../../Domain/UseCase/EditerUseCase"

var self = this
var useCase = new EditerUseCase()

this.on('mount', () => {
    if ( useCase.isLoggedIn() == true ) {
        self.tags.header_view.setUser( useCase.loggedUser() )
    }
})
</script>

<header_view />

    <div class="editor-page">
    <div class="container page">
        <div class="row">
    
        <div class="col-md-10 offset-md-1 col-xs-12">
            <form>
            <fieldset>
                <fieldset class="form-group">
                    <input type="text" class="form-control form-control-lg" placeholder="Article Title">
                </fieldset>
                <fieldset class="form-group">
                    <input type="text" class="form-control" placeholder="What's this article about?">
                </fieldset>
                <fieldset class="form-group">
                    <textarea class="form-control" rows="8" placeholder="Write your article (in markdown)"></textarea>
                </fieldset>
                <fieldset class="form-group">
                    <input type="text" class="form-control" placeholder="Enter tags"><div class="tag-list"></div>
                </fieldset>
                <button class="btn btn-lg pull-xs-right btn-primary" type="button">
                    Publish Article
                </button>
            </fieldset>
            </form>
        </div>
    
        </div>
    </div>
    </div>

<footer_view />

</editer_view_controller>