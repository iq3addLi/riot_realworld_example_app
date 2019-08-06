import "../View/HeaderView.tag"
import "../View/FooterView.tag"

<notfound_view_controller>

<style>
.spotlink{
    color: white;
    text-decoration: underline;
}
.spotlink:hover{
    color: white;
}
</style>

<div class="home-page">
    <!-- Header -->
    <header_view />

    <!-- Banner -->
    <div class="banner">
        <div class="container">
            <h1 class="logo-font">Your order is not found.<br/>Sorry, Please back <a class="spotlink" href="/">home</a>.</h1>
        </div>
    </div>

    <!-- Footer -->
    <footer_view />
</div>

</notfound_view_controller>