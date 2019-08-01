[![RealWorld Frontend](https://img.shields.io/badge/realworld-frontend-%23783578.svg)](http://realworld.io) <img title="Riot v3" src="https://img.shields.io/badge/RIOT-v3-red"> <img title="Riot v4 on progress" src="https://img.shields.io/badge/RIOT-v4%20on%20progress-red">

# ![RealWorld Example App](./img/realworld_example_apps.png)

> **Riot.js codebase containing real world examples (CRUD, auth, advanced patterns, etc) that adheres to the RealWorld spec and API.**

This project is a realworld implementation of riot.js v3. <u>The major version of riot.js is v4</u>. Please refer to the following about [this](#why-did-you-implement-it-using-v3).

```
⚠️ This project is influenced by iOS development. Please be aware that it may be out of the context of web development.
```



## The target of this example

- Web developer using riot.js
- iOS Engineer Interested in Web Development
- Someone who wants to develop a SPA or PWA.
- Someone interested in layered architecture.



## Getting started

### Clone project

```bash
$ cd << your working directory >>
$ git clone https://github.com/iq3addLi/riot_realworld_example_app.git
```

### Install packages

```bash
$ cd riot_realworld_example_app
$ npm install
```

### Launch server

```bash
$ gulp connect
```

### Open in browser

```bash
$ open http://localhost:8080
```



## Design policy

### iOS Development Style

All `.tag` and `.ts` in this project are written with iOS in mind. Because my goal is "How can enjoyed iOS Developer be coverted into web development?". I used lowerCamelCase as much as possible. I named the classes that came from iOS development. By doing so I was able to develop RealWorld smoothly. It can not be predicted how experienced web developers will feel it. However, I expect that there is something to discover.

This is also described [here](https://github.com/addli/motorhomes.addli.jp#appendix-web-technology-substitutable-to-ios-framework).

### Layerd Architecture

I use layered architecture for iOS, server-side, and Web development. (When I first learned it, it was called [Onion Architecture](https://jeffreypalermo.com/2008/07/the-onion-architecture-part-1/).)  It is divided into three layers, Presentation, Domain and Infrastructure. I will omit the description of this architecture here.

The reason why I adopted this architecture is

* Clients and API server applications can be developed as well.
* Don't need to depend on special libraries for implementation.
* Easy to understand, as the required classes can be minimized.

That's it. At least at the RealWorld scale, I think that I could prove that this architecture works. 

Although it is written assuming that the implementation is switched by Dependency Infection, it does not actually use DI. It is thought that maintenancebility will increase enough just by assuming in advance.

Also, the code of Domain, Infrastructure is **TypeScript**. I also intended to make the riot.js code in the presentation TypeScript. However, I gave up because I did not work on trying to do it with rollup.

As I noticed later, TypeScript can be realized by taking out all the implementations in tags.  It will be more like the relationship between the iOS storyboard and the implementation code.



## A careful as a latecomer

### The state of the page is expressed by URL as much as possible.

Senpai's projects are didn't express tab switching and pagination by URL. Since I'm a latecomer(say's Kouhai in Japan), I fixed that point slyly 😉.

| Scene    | Entity            | URL(path)                              |
| -------- | ----------------- | -------------------------------------- |
| articles | Your Articles     | `#/articles/your`                      |
|          | Global Articles   | `#/articles/` or `#/articles/global`   |
|          | Tag               | `#/articles/tag/{{tagword}}`           |
|          | pagenation        | `?page={{pagenumber}}`                 |
| profile  | My Articles       | `#/profile` or `#/profile/my_articles` |
|          | Favorite Articles | `#/profile/favorite_articles`          |
|          | pagenation        | `?page={{pagenumber}}`                 |

 I thought that even with SPA, the state of the page should be represented by the URL as much as possible. You will notice. Even if it reloads, it will be displayed without any problem. Thanks to riot and riot-route😘. 

However, there are concerns about this. It seems that URL is not supposed that get query is written after `#`. I'm not an expert in web development. So I judged this by looking at the behavior of [Location](https://developer.mozilla.org/en-US/docs/Web/API/Location) and [url-parse](https://github.com/unshiftio/url-parse).   After #, even if there was a query, it was ignored. So I wrote a simply parser for this project. I can't see if something bad happens because of this😰🚨🚓.



## Introspection

### Page updates are not minimal

I simplified the flow of updating the page by the process of routing according to the change of URL. Therefore, the UI has not been updated page is updated😅. 

(For example, each time you click an article tab in a profile scene, Profile view is updated again.)

By using pushState(), I think that it is possible to make the UI update only for the necessary UI while changing the URL. But this time I did not go there😅. I will try to remember as an improvement point. 



## Why did you implement it using v3?

I'm an iOS developer. I needed to learn web development, and I learned about riot.js at v3. **I thought riot.js is very useful for iOS developers**.  I wanted to let other people know why I thought so, and developed realworld with v3 of riot.js.

I haven't used v4 yet. However, it will probably meet my expectations. Next, I will fork this project to v4. By doing so, I will learn v4 😉.

