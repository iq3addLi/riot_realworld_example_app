import "../View/HeaderView.tag"
import "../View/FooterView.tag"

<editer_view_controller>

<script>
import EditerUseCase from "../../Domain/UseCase/EditerUseCase"

var self = this
var useCase = new EditerUseCase()

self.errors = null
self.on('mount', () => {
    // setup header
    self.tags.header_view.setItems( useCase.menuItems() )

    // request article
    useCase.ifNeededRequestArticle().then( (article) => {
        if (article === null ) return
        // setup form
        self.refs.titleField.value = article.title
        self.refs.descriptionField.value = article.description
        self.refs.bodyField.value = article.body
        self.refs.tagListField.value = article.tagList.join(",")
    })
})

self.actionOfSubmitButton = () => {
    let title = self.refs.titleField.value
    let description = self.refs.descriptionField.value
    let body = self.refs.bodyField.value
    let tagList = self.refs.tagListField.value

    useCase.post(title, description, body, tagList).then( (article) => {
        // success
        useCase.jumpPageByArticle(article)
    }).catch( (error) => {
        // failure
        if (error instanceof Array ) {
            self.errors = error.map( (aError) => aError.message )
        }else if( error instanceof Error ) {
            self.errors = [ error.message ]
        }
        self.update()
    })
}

self.submitButtonTitle = () => {
    return useCase.isNewArticle() ? "Publish Article" : "Update Article"
}

</script>

<header_view />

    <div class="editor-page">
    <div class="container page">
        <div class="row">
    
        <div class="col-md-10 offset-md-1 col-xs-12">

            <ul if={ errors != null } class="error-messages">
                <li each={ error in errors }>{ error }</li>
            </ul>
            <form>
            <fieldset>
                <fieldset class="form-group">
                    <input ref="titleField" type="text" class="form-control form-control-lg" placeholder="Article Title">
                </fieldset>
                <fieldset class="form-group">
                    <input ref="descriptionField" type="text" class="form-control" placeholder="What's this article about?">
                </fieldset>
                <fieldset class="form-group">
                    <textarea ref="bodyField" class="form-control" rows="8" placeholder="Write your article (in markdown)"></textarea>
                </fieldset>
                <fieldset class="form-group">
                    <input ref="tagListField" type="text" class="form-control" placeholder="Enter tags"><div class="tag-list"></div>
                </fieldset>
                <button class="btn btn-lg pull-xs-right btn-primary" type="button" onclick={ actionOfSubmitButton }>
                    { submitButtonTitle() }
                </button>
            </fieldset>
            </form>
        </div>
    
        </div>
    </div>
    </div>

<footer_view />

</editer_view_controller>