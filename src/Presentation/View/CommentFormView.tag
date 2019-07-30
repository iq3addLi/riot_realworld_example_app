<comment_form_view>

<script>

var self = this
self.profile = null

self.didSubmitHandler = () => {}
self.setProfile = ( profile ) => {
    self.profile = profile
    self.update()
}

self.actionOfPostCommentButton = () => {
    let comment = self.refs.commentArea.value
    self.didSubmitHandler( comment )
}

self.clearComment = () => {
    self.refs.commentArea.value = ""
}

</script>


<form class="card comment-form">

    <!-- comment form -->
    <div class="card-block">
        <textarea ref="commentArea" class="form-control" placeholder="Write a comment..." rows="3"></textarea>
    </div>

    <!-- comment footer -->
    <div class="card-footer">

        <!-- logged user icon -->
        <virtual if={ profile !== null }>
            <img src={ profile.image } class="comment-author-img" />
        </virtual>

        <!-- submit button -->
        <button onclick={ actionOfPostCommentButton } type="button" class="btn btn-sm btn-primary">
        Post Comment
        </button>
    </div>
    
</form>

</comment_form_view>
