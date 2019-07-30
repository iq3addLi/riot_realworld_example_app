<header_view>

<script>

var self = this

self.user = null
self.items = []
self.setUser = ( user ) => {
    self.user = user
    self.update()
}

self.isLoggedIn = () => {
    return self.user != null
}

self.setItems = (items) => {
    self.items = items
    self.update()
}

</script>

<style>
.nav-link .user-pic {
    margin-right: 0px;
}
</style>

<!-- Header -->
<nav class="navbar navbar-light">
    <div class="container">

        <!-- Logo -->
        <a class="navbar-brand" href="/">conduit</a>

        <!-- Menus -->
        <ul class="nav navbar-nav pull-xs-right">
            <li each={ item in items } class="nav-item">
                <a class={ nav-link: true, active: item.isActive } href={ item.href }>
                    &nbsp;
                    <i if={ item.icon !== null } class={ item.icon }></i>
                    <img if={ item.image !== null } class="user-pic" src={ item.image }>
                    { item.title }
                </a>
            </li>
        </ul>
    </div>
</nav>

</header_view>
