<profile_view>
    
<script>

var self = this

self.profile = null
self.isLoggedIn = false
self.isOwn = false
self.didClickButtonHandler = () => {}

self.setProfile = ( profile, isLoggedIn, isOwn ) => {
    self.profile = profile
    self.isLoggedIn = isLoggedIn
    self.isOwn = isOwn
    self.update()
}

self.buttonTitle = () => {
    let prof = self.profile
    if ( self.isOwn == true ){
        return "Edit Profile Settings"
    }else{
        return ( prof.following ? "Unfollow" : "Follow" ) + " " + prof.username
    }
}

self.actionOfProfileButton = () => {
    self.didClickButtonHandler( self.isOwn )
}

</script>

<virtual if={ profile !== null }>
    
    <img src={ profile.image } class="user-img" />
    <h4>{ profile.username }</h4>
    <p>{ profile.bio }</p>

    <button onclick={ actionOfProfileButton } class={ "btn btn-sm action-btn" + (profile.following ? " btn-secondary" : " btn-outline-secondary") }>
        <i class={ isOwn === true ? "ion-gear-a" : "ion-plus-round" }></i>&nbsp;{ buttonTitle() }
    </button>

</virtual>

</profile_view>
