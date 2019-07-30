<comment_table_view>

<script>
import marked from "marked"
import moment from "moment"

var self = this
self.comments = []
self.loggedUserProfile = null

self.didDeleteHandler = () => {}
self.setComments = ( comments ) => {
    self.comments = comments
    self.update()
}

self.markedBody = ( body ) => {
    return marked( body )
}

self.formattedDate = ( date ) => {
    return moment( date ).format("MMMM DD, YYYY"); 
}

self.actionOfTrashButton = ( commentId ) => {
    self.didDeleteHandler( commentId )
}

</script>

<div class="card" each={ comment in comments }>

    <!-- comment body -->
    <div class="card-block">
        <p class="card-text">
            <comment_body_view marked_body={ markedBody( comment.body ) } />
        </p>
    </div>

    <!-- comment footer -->
    <div class="card-footer">

        <!-- comment author infomation -->
        <a href="" class="comment-author">
            <img src={ comment.author.image } class="comment-author-img" />
        </a>
        &nbsp;
        <a href="" class="comment-author">{ comment.author.username }</a>
        <span class="date-posted">{ formattedDate( comment.createdAt ) }</span>

        <!-- comment controls -->
        <virtual if={ comment.author.username === loggedUserProfile.username }>
            <span class="mod-options">
                <!-- <i class="ion-edit"></i> -->
                <i onclick={ actionOfTrashButton.bind( this, comment.id ) } class="ion-trash-a"></i>
            </span>
        </virtual>
    </div>
</div>

</comment_table_view>

<comment_body_view>
this.root.innerHTML = opts.marked_body
this.on("update", () => {
    this.root.innerHTML = opts.marked_body
})
</comment_body_view>