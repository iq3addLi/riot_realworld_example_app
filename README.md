[![RealWorld Frontend](https://img.shields.io/badge/realworld-frontend-%23783578.svg)](http://realworld.io) [<img title="Riot v4 on progress" src="https://img.shields.io/badge/RIOT-v4%20on%20progress-red">](https://Riot.js.org) [![CircleCI](https://circleci.com/gh/iq3addLi/riot_v4_realworld_example_app.svg?style=shield)](https://circleci.com/gh/iq3addLi/riot_v4_realworld_example_app)

# ![RealWorld Example App](./logo.png)

> **Riot.js codebase containing real world examples (CRUD, auth, advanced patterns, etc) that adheres to the RealWorld spec and API.**

### [Demo](http://riot-v4-realworld.addli.co.jp)&nbsp;&nbsp;&nbsp;&nbsp;[RealWorld](https://github.com/gothinkster/realworld)

This project is  realworld/frontend implemented with Riot.js v4. For more information about realworld, see [realworld.io](https://realworld.io).



## Getting started

Same to [v3](https://github.com/iq3addLi/riot_realworld_example_app#getting-started).

### Clone project

```bash
$ cd << your working directory >>
$ git clone https://github.com/iq3addLi/riot_v4_realworld_example_app.git
```

### Install packages

```bash
$ cd riot_v4_realworld_example_app
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



## How to build

### Build with gulp and rollup

```bash
$ gulp
```

For details, please read [gulpfile](https://github.com/iq3addLi/riot_realworld_example_app/blob/master/gulpfile.js).



## Design policy

Same completely to [v3](https://github.com/iq3addLi/riot_realworld_example_app#design-policy).



## How this project uses Riot.js

### Pre-compile with npm packages

Riot.js can compile `.riot` files on browser side. This is very convenient for getting started quickly. However, I chose to precompile with npm for this project.  This is because TypeScript can be used for most of the implementation code. When developing applications as large as RealWorld, type checking with TypeScript greatly contributes to work efficiency. 

After a few trials, I concluded that the compilation task is rollup and other tasks are reliable to do with gulp. See **gulpfile.js** and **rollup.config.js**. I hope it will help those who are considering taking a configuration like this project. 



### `.riot` is the interface definition

I treated the `.riot` file as an interface definition.  Information to be displayed on the `.riot` side and functions called from event handlers are not coded in this, but are coded in `*ViewController.ts`.  

The reason is next

#### I wanted to use TypeScript as much as possible.

There is a way to write TypeScript in <script> in `.riot`, but even so, it is difficult to get editor support, and the benefits of writing in TypeScript are not as expected. So I tried to code the implementation on the `.ts` side, and the `.riot` side only coded the connection to the implementation. 

#### It has almost the same structure as iOS development

I will explain the second reason. I'm usually an iOS Developer. In iOS, the UI layout is described in a file called `.storyboard` or` .xib`. Both are XML.  Normally, editing is not done directly by hand, but can be done on the GUI using the Xcode SDK **InterfaceBuilder** function. After all, the information displayed on the UI and the action by event firing are described in the `.swift` implementation file. This relationship is very similar to the relationship between the `.riot` and the ` .ts` implementation code. This meant that the usual strategy could be put directly into web development. **Isn't this great?**

I was delighted to see that the power of Riot.js removed the barriers to web development. ✊



### Use [riot-route](https://github.com/riot/route) for routing

I used riot-route for routing following v3. riot-route is an independent and well-designed component that **can be used without modification in v4**. Major updates have not been made to match Riot.js, but there is no problem.



### Designed for large-scale development

Pre-compiling and bundling with npm, adopting TypeScript, all of this means thinking in advance to handle even larger requirements. Adding `i18next` to this structure will facilitate internationalization. If you need UI animation, you can borrow the power of `anime.js` and `Three.js`. If the UI becomes complicated, you can adopt a reactive libraries. 

I often witness that riot is worried that it is not suitable for large-scale development because of its simplicity. But **it ’s a complete misunderstanding**. There is nothing to sacrifice for the simplicity of Riot.js. Riotjs makes it possible to implement RealWorld, and even more complex applications can be written. My assumption is that it would be easy to implement facebook. Who wants more than that? 



##  Points to migrate from v3 to v4

### The import instruction has changed

Necessary when precompiling.

#### v3

```typescript
import riot from "riot"
```

#### v4

```typescript
import { component } from "riot"
```

In v4, it is now possible to import only the functions you want to use. 

You can also create and call a namespace like this

```typescript
import * as riot from 'riot'
```



### Mounted explicitly required unmount

From v4 you have to call unmount explicitly. Otherwise your UI will look like BOSS in part 5 of JOJO's bizarre adventure 😈.
Don't forget to put true in the second argument of `unmount`. The root tag will also disappear.

#### ex [v3](https://github.com/iq3addLi/riot_realworld_example_app/blob/1.0.0/src/Domain/UseCase/ApplicationUseCase.ts#L84), [v4](https://github.com/iq3addLi/riot_v4_realworld_example_app/blob/master/src/Domain/UseCase/ApplicationUseCase.ts#L79-L80)



### Measures against access to childview being deleted

This was the most difficult part of migrating to v4. 

[Access to parent and child views from v4 has been removed.](https://riot.js.org/migration-guide/#parent-and-children) I able understand Riot.js remove access to parent view. But, I skeptical about remove access to child views. 

I tried using the `riot-ref-plugin.js` described in the official migration guide, but this didn't work 😢.

After trying a lot, I realized that I got a mounted RiotComponent with the `component()` function.
I kept this reference in the implementation code of `.ts`. Just like `IBOutlet` in iOS development.

**ex.**  [Article table view mounted in article scene](https://github.com/iq3addLi/riot_v4_realworld_example_app/blob/master/src/Presentation/ViewController/Articles.riot#L16-L55)

```typescript
    onMounted(_,state){
        let owner = state.owner
      	...(Omitted)...
        // Mount child components and Connect action
        let articlesTableView = component(ArticlesTableView)( this.$("#articlesTableView"), {
            didSelectProfile: owner.didSelectProfile,
            didSelectArticle: owner.didSelectArticle,
            didFavoriteArticle: owner.didFavoriteArticle
        })
      	...(Omitted)...
        // Connect outlet
        owner.articlesTableView = articlesTableView
      	...(Omitted)...
    }
```

**ex.**  [Property on the implementation code side](https://github.com/iq3addLi/riot_v4_realworld_example_app/blob/1.0.0/src/Presentation/ViewController/ArticlesViewController.ts#L7-L16)

```typescript
export default class ArticlesViewController {

    // Outlets
    ...(Omitted)...
    articlesTableView: RiotCoreComponent|any
    ...(Omitted)...
```

ArticlesTableView is a view that lists article title and description. `owner` is the implementation code written in `.ts`. When the parent view `onMount ()` is executed, it explicitly indicates the mount of the child view. (It was done implicitly in v3. I think it was smarter with less boilerplate code, but it can't be helped 🙃)  The `| any` is used to suppress TypeScript warnings. Even in iOS development, there is no checking mechanism for IBOutlet connection, so it may cause problems by connecting an unexpected view at the beginning. I didn't think this was a problem because the mechanism was almost the same.

When the child view is mounted, the handler of the event issued from the child view is passed as initialProps. This is very similar to the `IBAction` connection in iOS development. 

I was able to use the same design as v3 to restore access to child views in the above way.

It's a boring idea,  Child view has a relationship shared life and death with the parent view from the beginning in the screen transition. If so, using that relationship to allow access to the child is the least wasteful way. I think that using the `Observable` or Reactive libraries and trying to add another relationship is the last method to consider. In many cases (even as large as RealWorld), it can be implemented without relying on them.

If only the official migration guide has an alternative, the difficulty of using Riot.js will increase dramatically. In the next major version, I expect riot.js to get back access to child views. `parent` is not required. If the reference is unidirectional, in many cases the problem should not occur.  



### Writing event handlers with arguments

In v3 you had to use `bind()`, but in v4 you can now do more appropriate writing.

#### ex. [v3](https://github.com/iq3addLi/riot_realworld_example_app/blob/1.0.0/src/Presentation/View/CommentTableView.tag#L54), [v4](https://github.com/iq3addLi/riot_v4_realworld_example_app/blob/1.0.0/src/Presentation/View/CommentTableView.riot#L62)



### Other things (officially guided)

[Change extension from .tag to .riot](http://Riot.js.org/documentation/#syntax)

[Rewrite `.riot` script to` export default`](https://Riot.js.org/migration-guide/#the-script-tag)

[Move local variable to `state`](https://Riot.js.org/migration-guide#opts-vs-props-and-state)

[<virtual> to <template>](https://Riot.js.org/migration-guide/#virtual-tags)  There was no trouble just by rewriting :)



## Migrated impressions

The adoption of Layered Archtecture made the transition to v4 very smooth. The effect is limited to the presentation layer only. Look at the commit log after August 8th. You can see that the important fixes are concentrated under `src/Presentation`.  The most time-consuming process was to find out how to implement my design with v4. If you know it in advance, I can migrate in a day. Thanks to Riot.js for making this structure easier.

Since the access method to childView was cut off from riot, I had to push the idea of iOS Development more than v3 in order to organize thoughts. However, this allowed the idea of .riot files to be advanced to `.xib without InterfaceBuilder`.  This has the disadvantage of not being able to get InterfaceBuilder support, but it also has the advantage of being able to define a UI that is smarter than `.xib`.



## For those interested in Riot.js

I've been using Riot.js since 2016 to develop our services. Riot.js is very simple as declared. I was able to devote my time to learning deeply about this framework to study other useful libraries. Since Riot.js does not have many functions by itself, there is not much discussion about itself. That's why I don't see many names on the web. This is because Riot.js users can spend more time learning how to use useful libraries like `moment`, ` i18next`,  `inversity`, `markd`, etc. rather than thinking about the framework.  

I wish you the best choice without being bound by numbers like Google Trend or Github star 😉.