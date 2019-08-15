[![RealWorld Frontend](https://img.shields.io/badge/realworld-frontend-%23783578.svg)](http://realworld.io) [<img title="Riot v4 on progress" src="https://img.shields.io/badge/RIOT-v4%20on%20progress-red">](https://riot.js.org) [![CircleCI](https://circleci.com/gh/iq3addLi/riot_v4_realworld_example_app.svg?style=shield)](https://circleci.com/gh/iq3addLi/riot_v4_realworld_example_app)

# ![RealWorld Example App](./logo.png)

> **Riot.js codebase containing real world examples (CRUD, auth, advanced patterns, etc) that adheres to the RealWorld spec and API.**

### [Demo](http://riot-v4-realworld.addli.co.jp)&nbsp;&nbsp;&nbsp;&nbsp;[RealWorld](https://github.com/gothinkster/realworld)

This project is  realworld/frontend implemented with riot.js v4. For more information about realworld, see [realworld.io](https://realworld.io).



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



## How this project uses riot.js

###Pre-compile with npm packages

Riot.js can compile `.riot` files on the server side. This is very convenient for getting started quickly. However, I chose to precompile with npm for this project.  This is because TypeScript can be used for most of the implementation code. When developing applications as large as RealWorld, type checking with TypeScript greatly contributes to work efficiency. 

After a few trials, I concluded that the compilation task is rollup and other tasks are reliable to do with gulp. See gulpfile.js and rollup.config.js. I hope it will help those who are considering taking a configuration like this project.



### `.riot` is the interface definition

I treated the `.riot` file as an interface definition.  Information to be displayed on the `.riot` side and functions called from event handlers are not coded in this, but are coded in `*ViewController.ts`.  

The reason is next

* I wanted to use TypeScript as much as possible.
  * There is a way to write TypeScript in <script> in `.riot`, but even so, it is difficult to get editor support, and the benefits of writing in TypeScript are not as expected.
* It has almost the same structure as iOS application development

I will explain the second reason. I'm usually an iOS Developer. In iOS, the UI layout is described in a file called `.storyboard` or` .xib`. Both are XML.  Normally, editing is not done directly by hand, but can be done on the GUI using the Xcode SDK **InterfaceBuilder** function. After all, the information displayed on the UI and the action by event firing are described in the `.swift` implementation file. This relationship is very similar to the relationship between the `.riot` and the` .ts` implementation code. This meant that the usual strategy could be put directly into web development. **Isn't this great?**

I was delighted to see that the power of riot.js removed the barriers to web development. ✊



### Use riot-route for routing

I used [riot-route](We used riot-route for routing following v3) for routing following v3. riot-route is an independent and well-designed component that **can be used without modification in v4**. Major updates have not been made to match riot.js, but there is no problem.



### Designed for large-scale development

Pre-compiling and bundling with npm, adopting TypeScript, all of this means thinking in advance to handle even larger requirements. Adding `i18next` to this structure will facilitate internationalization. If the UI becomes complicated, you can adopt a reactive libraries.

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

#### ex [v3](https://github.com/iq3addLi/riot_realworld_example_app/blob/1.0.0/src/Domain/UseCase/ApplicationUseCase.ts#L84), [v4](https://github.com/iq3addLi/riot_v4_realworld_example_app/blob/master/src/Domain/UseCase/ApplicationUseCase.ts#L79-L80)



### Measures against access to childview being deleted

🖋Now writing...



### Writing event handlers with arguments

In v3 you had to use `bind ()`, but in v4 you can now do more appropriate writing.

#### ex. [v3](https://github.com/iq3addLi/riot_realworld_example_app/blob/1.0.0/src/Presentation/View/CommentTableView.tag#L54), [v4](https://github.com/iq3addLi/riot_v4_realworld_example_app/blob/1.0.0/src/Presentation/View/CommentTableView.riot#L62)



### Other things (officially guided)

* [Change extension from .tag to .riot](http://riot.js.org/documentation/#syntax)
* [Rewrite `.riot` script to` export default`](https://riot.js.org/migration-guide/#the-script-tag)
* [Move local variable to `state`](https://riot.js.org/migration-guide#opts-vs-props-and-state)
* [<virtual> to <template>](https://riot.js.org/migration-guide/#virtual-tags)  There was no trouble just by rewriting :)



## Migrated impressions

🖋Now writing...

