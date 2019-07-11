<header_view>

<script>

    var self = this
    
    self.user = null
    self.setUser = ( user ) => {
        self.user = user
        self.update()
    }

    self.isLoggedIn = () => {
        return self.user != null
    }


</script>

<nav class="navbar navbar-light">
    <div class="container">
        <a class="navbar-brand" href="/">conduit</a>

        <ul class="nav navbar-nav pull-xs-right">
            <li class="nav-item">
                <!-- Add "active" class when you're on that page" -->
                <a class="nav-link active" href="#/">Home</a>
            </li>

            <virtual if={ isLoggedIn() == true }>
                <li class="nav-item">
                    <a class="nav-link" href="#/editer"><i class="ion-compose"></i>&nbsp;New Post</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="#/settings"><i class="ion-gear-a"></i>&nbsp;Settings</a>
                </li>

                <li class="nav-item">
                    <a class="nav-link" href="#/profile">{ user.username }</a>
                </li>
            </virtual>
            <virtual if={ isLoggedIn() == false }>
                <li class="nav-item">
                    <a class="nav-link" href="#/login">Sign In</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="#/register">Sign up</a>
                </li>
            </virtual>
        </ul>
    </div>
</nav>

</header_view>

          